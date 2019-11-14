import { curve, Group, Point, Scalar } from "@dedis/kyber";
import { schnorr } from "@dedis/kyber/sign";
import { Private, Public } from "./dynacred/KeyPair";

export const ENCODING: string = "hex";

// variables of a GroupDefinition
export interface IGroupDefinition {
    id?: string;
    orgPubKeys: Public[];
    suite: Group;
    voteThreshold: number;
    purpose: string;
    signatures?: string[];
    successor?: string[];
    predecessor?: string[];
    creationTime?: Date;
    lastTimeModified?: Date;
    voteThresholdEvolution?: boolean;
    purposeEvolution?: boolean;
}

export class GroupDefinition {

    static createFromJSON(text: string): GroupDefinition {
        const jsonText = JSON.parse(text);

        // check the JSON soundness
        if (!jsonText.hasOwnProperty("orgPubKeys")) {
            throw new Error("Property orgPubKeys is missing from the JSON");
        } else if (!jsonText.hasOwnProperty("voteThreshold")) {
            throw new Error("Property voteThreshold is missing from the JSON");
        } else if (!jsonText.hasOwnProperty("purpose")) {
            throw new Error("Property purpose is missing from the JSON");
        }
        // TODO
        // else if (!jsonObject.hasOwnProperty("suite")) {
        //     throw new Error("Property suite is missing from the JSON");
        // }

        // type translation for some properties
        const orgPubKeys: Public[] = jsonText.orgPubKeys.map((pubKey) => Public.fromHex(pubKey));
        // TODO how to manage suite?
        const suite: Group = curve.newCurve("edwards25519");

        const jsonObject: IGroupDefinition = {
            id: jsonText.contractID,
            orgPubKeys,
            suite,
            voteThreshold: +jsonText.voteThreshold,
            purpose: jsonText.purpose,
            signatures: jsonText.signatures,
            successor: jsonText.successor,
            predecessor: jsonText.predecessor ? jsonText.predecessor : [],
            creationTime: new Date(jsonText.creationTime),
            lastTimeModified: new Date(jsonText.lastTimeModified),
            voteThresholdEvolution: jsonText.voteThresholdEvolution ? JSON.parse(jsonText) : undefined,
            purposeEvolution: jsonText.purposeEvolution ? JSON.parse(jsonText) : undefined,
        };

        return new GroupDefinition(jsonObject);
    }

    private variables: IGroupDefinition;

    constructor(variables: IGroupDefinition) {
        this.variables = variables;

        this.variables.creationTime = variables.creationTime ? variables.creationTime : new Date();
        this.variables.lastTimeModified = variables.lastTimeModified
            ? variables.lastTimeModified
            : this.variables.creationTime;

        if (!this.variables.predecessor) {
            this.variables.predecessor = [];
        }

        if (!this.variables.successor) {
            this.variables.successor = [];
        }

        if (!this.variables.signatures) {
            this.variables.signatures = [];
        }

        if (!this.variables.id) {
            const toBeHashed: Buffer[] = [
                this.variables.orgPubKeys.join(),
                this.variables.voteThreshold.toFixed(),
                this.variables.purpose,
                this.variables.predecessor.join(),
                this.variables.creationTime.toISOString(),
            ].map((el) => Buffer.from(el));
            // tslint:disable-next-line: max-line-length
            this.variables.id = schnorr.hashSchnorr(this.variables.suite, ...toBeHashed).marshalBinary().toString(ENCODING);
        }
    }

    toJSON(): string {
        // TODO find a solution for field "suite"
        const jsonObject = {
            contractID: this.variables.id,
            orgPubKeys: this.variables.orgPubKeys.map((pubKey) => pubKey.toHex()),
            // suite: Group,
            voteThreshold: this.variables.voteThreshold,
            purpose: this.variables.purpose,
            signatures: this.variables.signatures,
            successor: this.variables.successor ? this.variables.successor : undefined,
            predecessor: this.variables.predecessor ? this.variables.predecessor : undefined,
            creationTime: this.variables.creationTime,
            lastTimeModified: this.variables.lastTimeModified,
            voteThresholdEvolution: this.variables.voteThresholdEvolution,
            purposeEvolution: this.variables.purposeEvolution,
        };

        return JSON.stringify(jsonObject);
    }

    addSignature(privateKey: Private) {
        // create signature
        const message: Buffer = Buffer.from(this.variables.id, ENCODING);
        const signature: string = schnorr.sign(this.variables.suite, privateKey.scalar, message).toString(ENCODING);
        // append signature
        this.variables.signatures.push(signature);
        this.variables.lastTimeModified = new Date();
    }

    // verify the soundess of the group definition; not if the threshold has been reached
    verify(): boolean {
        // verify contractID
        const toBeHashed: Buffer[] = [
            this.variables.orgPubKeys.join(),
            this.variables.voteThreshold.toFixed(),
            this.variables.purpose,
            this.variables.predecessor.join(),
            this.variables.creationTime.toISOString(),
        ].map((el) => Buffer.from(el));
        // tslint:disable-next-line: max-line-length
        const contractIDToCheck = schnorr.hashSchnorr(this.variables.suite, ...toBeHashed).marshalBinary().toString(ENCODING);
        if (contractIDToCheck !== this.variables.id) {
            return false;
        }

        // verify signatures
        // if the number of signatures is larger than the number of public keys
        // then an organizer have signed at least twice.
        if (this.variables.orgPubKeys.length < this.variables.signatures.length) {
            return false;
        }
        if (this.variables.signatures.length) {
            const message: Buffer = Buffer.from(this.variables.id, ENCODING);
            const verifiedSig: boolean[] = this.variables.signatures.map((sig: string) => {
                for (const publicKey of this.variables.orgPubKeys) {
                    if (schnorr.verify(this.variables.suite, publicKey.point, message, Buffer.from(sig, ENCODING))) {
                        return true;
                    }
                }
                return false;
            });
            if (!verifiedSig.reduce((bool1, bool2) => bool1 && bool2)) {
                return false;
            }
        }

        return true;
    }

    proposeNewGroupDefinition(proposition: IGroupDefinition): GroupDefinition {
        if (this.variables.purpose !== proposition.purpose && !this.purposeEvolution) {
            throw new Error("You cannot modify purpose field");
        }

        if (this.variables.voteThreshold !== proposition.voteThreshold && !this.voteThresholdEvolution) {
            throw new Error("You cannot modify voteThreshold field");
        }

        // reset variables
        proposition.id = undefined;
        proposition.creationTime = undefined;
        proposition.lastTimeModified = undefined;
        proposition.signatures = undefined;
        proposition.successor = undefined;
        proposition.predecessor = [this.variables.id];
        const propGroupDefinition = new GroupDefinition(proposition);
        this.variables.successor.push(propGroupDefinition.variables.id);
        return propGroupDefinition;
    }

    mergeSignatures(groupDefinition: GroupDefinition) {
        if (this.variables.id === groupDefinition.variables.id) {
            const newSignatures: string[] = groupDefinition.variables.signatures.filter((sig: string, idx: number) => {
                return this.variables.signatures.indexOf(sig) !== idx;
            });
            newSignatures.forEach((sig: string) => this.variables.signatures.push(sig));
            this.variables.lastTimeModified = new Date();
        }
    }

    get id(): string {
        return this.variables.id;
    }

    get publicKeys(): Public[] {
        return this.variables.orgPubKeys;
    }

    get numbOrganizers(): number {
        return this.variables.orgPubKeys.length;
    }

    get suite(): Group {
        return this.variables.suite;
    }

    get voteThreshold(): number {
        return this.variables.voteThreshold;
    }

    get purpose(): string {
        return this.variables.purpose;
    }

    get signatures(): string[] {
        return this.variables.signatures;
    }

    get predecessor(): string[] {
        return this.variables.predecessor;
    }

    get successor(): string[] {
        return this.variables.successor;
    }

    get creationTime(): Date {
        return this.variables.creationTime;
    }

    get lastTimeModified(): Date {
        return this.variables.lastTimeModified;
    }

    get voteThresholdEvolution(): boolean {
        return this.variables.voteThresholdEvolution;
    }

    get purposeEvolution(): boolean {
        return this.variables.purposeEvolution;
    }

    get allVariables(): IGroupDefinition {
        // Deep copy of the object variables
        return {
            id: this.variables.id,
            orgPubKeys: [...this.variables.orgPubKeys],
            suite: this.variables.suite,
            voteThreshold: this.variables.voteThreshold,
            purpose: this.variables.purpose,
            signatures: [...this.variables.signatures],
            successor: [...this.variables.successor],
            predecessor: [...this.variables.predecessor],
            creationTime: this.variables.creationTime,
            lastTimeModified: this.variables.lastTimeModified,
            voteThresholdEvolution: this.variables.voteThresholdEvolution,
            purposeEvolution: this.variables.purposeEvolution,

        };
    }
}

import { curve, Group, Point, Scalar } from "@dedis/kyber";
import { schnorr } from "@dedis/kyber/sign";
import { Private, Public } from "./dynacred/KeyPair";
import GroupDefinitionCollection from "./groupDefinitionCollection";

const HEX_ENCODING: string = "hex";

// variables of a GroupDefinition
export interface IGroupDefinition {
    contractID?: string;
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
            contractID: jsonText.contractID,
            orgPubKeys,
            suite,
            voteThreshold: +jsonText.voteThreshold,
            purpose: jsonText.purpose,
            signatures: jsonText.signatures,
            successor: jsonText.successor,
            predecessor: jsonText.predecessor,
            creationTime: new Date(jsonText.creationTime),
            lastTimeModified: new Date(jsonText.lastTimeModified),
            voteThresholdEvolution: jsonText.voteThresholdEvolution ? JSON.parse(jsonText) : undefined,
            purposeEvolution: jsonText.purposeEvolution ? JSON.parse(jsonText) : undefined,
        }

        return new GroupDefinition(jsonObject);
    }

    private variables: IGroupDefinition;

    constructor(variables: IGroupDefinition) {
        this.variables = variables;

        this.variables.creationTime = variables.creationTime ? variables.creationTime : new Date();
        this.variables.lastTimeModified = variables.lastTimeModified ? variables.lastTimeModified : new Date();

        if (!this.variables.predecessor) {
            this.variables.predecessor = [];
        }

        if (!this.variables.signatures) {
            this.variables.signatures = [];
        }

        if (!this.variables.contractID) {
            const toBeHashed: Buffer[] = [
                this.variables.orgPubKeys.join(),
                this.variables.voteThreshold.toFixed(),
                this.variables.purpose,
                this.variables.predecessor.join(),
                this.variables.creationTime.toISOString(),
            ].map((el) => Buffer.from(el));
            this.variables.contractID = schnorr.hashSchnorr(this.variables.suite, ...toBeHashed).marshalBinary().toString(HEX_ENCODING);
        }
    }

    toJSON(): string {
        // TODO find a solution for field "suite"
        const jsonObject = {
            contractID: this.variables.contractID,
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
        const message: Buffer = Buffer.from(this.variables.contractID, HEX_ENCODING);
        const signature: string = schnorr.sign(this.variables.suite, privateKey.scalar, message).toString(HEX_ENCODING);
        // append signature
        this.variables.signatures.push(signature);
        this.variables.lastTimeModified = new Date();
    }

    verify(): boolean {
        // verify contractID
        const toBeHashed: Buffer[] = [
            this.variables.orgPubKeys.join(),
            this.variables.voteThreshold.toFixed(),
            this.variables.purpose,
            this.variables.predecessor.join(),
            this.variables.creationTime.toISOString(),
        ].map((el) => Buffer.from(el));
        const contractIDToCheck = schnorr.hashSchnorr(this.variables.suite, ...toBeHashed).marshalBinary().toString(HEX_ENCODING);
        if (contractIDToCheck !== this.variables.contractID) {
            return false;
        }

        // verify signatures
        const message: Buffer = Buffer.from(this.variables.contractID, HEX_ENCODING);
        const verifiedSig: boolean[] = this.variables.signatures.map((sig: string) => {
            for (const pubKey of this.variables.orgPubKeys) {
                if (schnorr.verify(this.variables.suite, pubKey.point, message, Buffer.from(sig, HEX_ENCODING))) {
                    return true;
                }
            }
            return false;
        });
        if (!verifiedSig.reduce((bool1, bool2) => bool1 && bool2)) {
            return false;
        }

        // verify vote threshold
        // tslint:disable-next-line: max-line-length
        if (!((this.variables.signatures.length / this.variables.orgPubKeys.length) * 100 >= this.variables.voteThreshold)) {
            return false;
        }

        return true;
    }

    validate(): boolean {
        // tslint:disable-next-line: max-line-length
        return (this.variables.signatures.length / this.variables.orgPubKeys.length) * 100 >= this.variables.voteThreshold;
    }

    proposeNewGroupDefinition(proposition: IGroupDefinition): GroupDefinition {
        const propGroupDefinition = new GroupDefinition(proposition);
        this.variables.successor.push(propGroupDefinition.variables.contractID);
        this.variables.creationTime = new Date();
        this.variables.lastTimeModified = this.variables.creationTime;
        return propGroupDefinition;
    }

    mergeSignatures(groupDefinition: GroupDefinition) {
        if (this.variables.contractID === groupDefinition.variables.contractID) {
            const newSignatures: string[] = groupDefinition.variables.signatures.filter((sig: string, idx: number) => {
                return this.variables.signatures.indexOf(sig) !== idx;
            });
            newSignatures.forEach((sig: string) => this.variables.signatures.push(sig));
            this.variables.lastTimeModified = new Date();
        }
    }

    // TODO useful? Do it recursively
    // TODO to be tested
    // TODO to be displaced into groupDefinitionCollection
    getWorldView(groupDefinition: GroupDefinition) {
        const groupDefinitionCollection = GroupDefinitionCollection.getInstance();
        const children = groupDefinitionCollection.getChildren(groupDefinition);
        return children.map((c: GroupDefinition) => {
            return this.getWorldView(c).unshift(groupDefinition);
        });
    }

    get contractID(): string {
        return this.variables.contractID;
    }

    get organizers(): Public[] {
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
}

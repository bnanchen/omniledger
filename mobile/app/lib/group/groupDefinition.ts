import { Group, Point, Scalar } from "@dedis/kyber";
import { schnorr } from "@dedis/kyber/sign";
import { Private, Public } from "../dynacred/KeyPair";
import GroupDefinitionCollection from "./groupDefinitionCollection";

// variables of a GroupDefinition
export interface IGroupDefinition {
    contractID?: Scalar;
    readonly orgPubKeys: Public[];
    readonly suite: Group;
    readonly voteThreshold: number;
    readonly purpose: string;
    readonly signatures?: string[];
    successor?: Scalar[];
    readonly predecessor?: Scalar[];
    creationTime?: Date;
    lastTimeModified?: Date;
    voteThresholdEvolution?: boolean;
    purposeEvolution?: boolean;
}

export class GroupDefinition {

    static createFromJSON(jsonText: string): GroupDefinition {
        const jsonObject = JSON.parse(jsonText);

        // check the JSON soundness
        if (!jsonObject.hasOwnProperty("contractID")) {
            throw new Error("Property is contractID missing from the JSON");
        } else if (!jsonObject.hasOwnProperty("orgPubKeys")) {
            throw new Error("Property orgPubKeys is missing from the JSON");
        } else if (!jsonObject.hasOwnProperty("voteThreshold")) {
            throw new Error("Property voteThreshold is missing from the JSON");
        } else if (!jsonObject.hasOwnProperty("signatures")) {
            throw new Error("Property signatures is missing from the JSON");
        } else if (!jsonObject.hasOwnProperty("successor")) {
            throw new Error("Property successor is missing from the JSON");
        } else if (!jsonObject.hasOwnProperty("predecessor")) {
            throw new Error("Property predecessor is missing from the JSON");
        } else if (!jsonObject.hasOwnProperty("creationTime")) {
            throw new Error("Property creationTime is missing from the JSON");
        } else if (!jsonObject.hasOwnProperty("purpose")) {
            throw new Error("Property purpose is missing from the JSON");
        } else if (!jsonObject.hasOwnProperty("suite")) {
            throw new Error("Property suite is missing from the JSON");
        }

        return new GroupDefinition(jsonObject as IGroupDefinition);
    }

    private variables: IGroupDefinition;

    constructor(variables: IGroupDefinition) {
        this.variables = variables;

        this.variables.creationTime = typeof variables.creationTime === "undefined" ? new Date() : variables.creationTime;
        this.variables.lastTimeModified = typeof variables.lastTimeModified === "undefined" ? new Date() : variables.lastTimeModified;
        if (!this.variables.contractID) {
            const toBeHashed: Buffer[] = [
                this.variables.orgPubKeys.join(),
                this.variables.voteThreshold.toFixed(),
                this.variables.purpose,
                this.variables.predecessor.map((p) => p.marshalBinary().toString()).join(),
                this.variables.creationTime.toISOString(),
            ].map((el) => new Buffer(el));
            this.variables.contractID = schnorr.hashSchnorr(this.variables.suite, ...toBeHashed);
        }
    }

    toJSON(): string {
        return JSON.stringify(this.variables as IGroupDefinition);
    }

    addSignature(privateKey: Private) {
        // create signature
        const message: Buffer = this.variables.contractID.marshalBinary();
        const signature: string = schnorr.sign(this.variables.suite, privateKey.scalar, message).toString("hex");
        // append signature
        this.variables.signatures.push(signature);
        this.variables.lastTimeModified = new Date();
    }

    verify(): boolean {
        // verify contractID
        const toBeHashed: Buffer[] = [
            this.variables.orgPubKeys.join(),
            this.variables.voteThreshold.toFixed(),
            this.variables.predecessor.map((p) => p.marshalBinary.toString()).join(),
            this.variables.creationTime.toISOString(),
        ].map((el) => new Buffer(el));
        const contractIDToCheck = schnorr.hashSchnorr(this.variables.suite, ...toBeHashed);
        if (contractIDToCheck !== this.variables.contractID) {
            return false;
        }

        // verify signatures
        const message = this.variables.contractID.marshalBinary();
        const verifiedSig: boolean[] = this.variables.signatures.map((sig: string) => {
            for (const pubKey of this.variables.orgPubKeys) {
                if (schnorr.verify(this.variables.suite, pubKey.point, message, new Buffer(sig))) {
                    return true;
                }
                return false;
            }
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
    getWorldView(groupDefinition: GroupDefinition) {
        const groupDefinitionCollection = GroupDefinitionCollection.getInstance();
        const children = groupDefinitionCollection.getChildren(groupDefinition);
        return children.map((c: GroupDefinition) => {
            return this.getWorldView(c).unshift(groupDefinition);
        });
    }

    get contractID(): Scalar {
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

    get predecessor(): Scalar[] {
        return this.variables.predecessor;
    }

    get successor(): Scalar[] {
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

import { curve, Group, Point, Scalar } from "@dedis/kyber";
import { schnorr } from "@dedis/kyber/sign";
import { Private, Public } from "../dynacred/KeyPair";
import { ENCODING } from "./groupContract";

// variables of a GroupDefinition
export interface IGroupDefinition {
    orgPubKeys: Public[];
    suite: Group;
    voteThreshold: number;
    purpose: string;
    predecessor?: string[];
}

export class GroupDefinition {

    static createFromJSON(json: string): GroupDefinition {
        const jsonText = JSON.parse(json);

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
            orgPubKeys,
            suite,
            voteThreshold: +jsonText.voteThreshold,
            purpose: jsonText.purpose,
            predecessor: jsonText.predecessor ? jsonText.predecessor : [],
        };

        return new GroupDefinition(jsonObject);
    }

    private variables: IGroupDefinition;

    constructor(variables: IGroupDefinition) {
        this.variables = variables;

        if (!this.variables.predecessor) {
            this.variables.predecessor = [];
        }
    }

    toJSON(): string {
        // TODO find a solution for field "suite"
        const jsonObject = {
            orgPubKeys: this.variables.orgPubKeys.map((pubKey) => pubKey.toHex()),
            // suite: Group,
            voteThreshold: this.variables.voteThreshold,
            purpose: this.variables.purpose,
            predecessor: this.variables.predecessor ? this.variables.predecessor : undefined,
        };

        return JSON.stringify(jsonObject);
    }

    // verify the soundess of the group definition; not if the threshold has been reached
    verify(id: string, signoffs: string[]): boolean {
        // verify signatures
        // if the number of signatures is larger than the number of public keys
        // then an organizer have signed at least twice.
        if (this.variables.orgPubKeys.length < signoffs.length) {
            return false;
        }

        if (signoffs.length) {
            const message: Buffer = Buffer.from(id, ENCODING);
            const verifiedSig: boolean[] = signoffs.map((sig: string) => {
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

    get predecessor(): string[] {
        return this.variables.predecessor;
    }

    get allVariables(): IGroupDefinition {
        // Deep copy of the object variables
        return {
            orgPubKeys: [...this.variables.orgPubKeys],
            suite: this.variables.suite,
            voteThreshold: this.variables.voteThreshold,
            purpose: this.variables.purpose,
            predecessor: [...this.variables.predecessor],
        };
    }
}

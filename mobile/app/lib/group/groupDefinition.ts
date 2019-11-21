import { curve, Group, Point, Scalar } from "@dedis/kyber";
import { schnorr } from "@dedis/kyber/sign";
import { Private, Public } from "../dynacred/KeyPair";
import { ENCODING } from "./groupContract";

// variables of a GroupDefinition
export interface IGroupDefinition {
    orgPubKeys: string[];
    suite: string;
    voteThreshold: string;
    purpose: string;
    predecessor?: string[];
}

export class GroupDefinition {

    static createFromJSON(json: IGroupDefinition): GroupDefinition {
        // const jsonText = JSON.parse(json);

        // check the JSON soundness
        if (!json.hasOwnProperty("orgPubKeys")) {
            throw new Error("Property orgPubKeys is missing from the JSON");
        } else if (!json.hasOwnProperty("voteThreshold")) {
            throw new Error("Property voteThreshold is missing from the JSON");
        } else if (!json.hasOwnProperty("purpose")) {
            throw new Error("Property purpose is missing from the JSON");
        } else if (!json.hasOwnProperty("suite")) {
            throw new Error("Property suite is missing from the JSON");
        }

        const jsonObject: IGroupDefinition = {
            orgPubKeys: json.orgPubKeys,
            suite: json.suite,
            voteThreshold: json.voteThreshold,
            purpose: json.purpose,
            predecessor: json.predecessor ? json.predecessor : [],
        };

        return new GroupDefinition(jsonObject);
    }

    private static getGroup(suite: string): Group {
        switch (suite) {
            case "edwards25519":
                return curve.newCurve("edwards25519");
        }
    }

    private variables: IGroupDefinition;

    constructor(variables: IGroupDefinition) {
        this.variables = variables;

        if (!this.variables.predecessor) {
            this.variables.predecessor = [];
        }
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
            const suite: Group = GroupDefinition.getGroup(this.variables.suite);
            const verifiedSig: boolean[] = signoffs.map((sig: string) => {
                for (const publicKey of this.variables.orgPubKeys) {
                    if (schnorr.verify(suite, Public.fromHex(publicKey).point, message, Buffer.from(sig, ENCODING))) {
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

    toJSON(): IGroupDefinition {
        // TODO find a solution for field "suite"
        return {
            orgPubKeys: this.variables.orgPubKeys,
            suite: this.variables.suite, // suite: Group,
            voteThreshold: this.variables.voteThreshold,
            purpose: this.variables.purpose,
            predecessor: this.variables.predecessor ? this.variables.predecessor : undefined,
        };
    }

    get publicKeys(): string[] {
        return this.variables.orgPubKeys;
    }

    get numbOrganizers(): number {
        return this.variables.orgPubKeys.length;
    }

    get suite(): string {
        return this.variables.suite;
    }

    get suiteGroup(): Group {
        return GroupDefinition.getGroup(this.variables.suite);
    }

    get voteThreshold(): string {
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

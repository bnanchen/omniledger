// tslint:disable-next-line
require("nativescript-nodeify");
import { curve, Group, Point } from "@dedis/kyber";
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

    sign(privateKey: Private): string {
        const message: Buffer = Buffer.from(this.getId(), ENCODING);
        return schnorr.sign(this.suiteGroup, privateKey.scalar, message).toString(ENCODING);
    }

    // verify the soundess of the group definition; not if the threshold has been reached
    verify(signoffs: string[], ...parent: GroupDefinition[]): boolean {
        if (!parent.map((p) => this.verifyId(p)).reduce((bool1: boolean, bool2: boolean) => bool1 && bool2)) {
            return false;
        }

        // verify signatures
        // if the number of signatures is larger than the number of public keys
        // then an organizer have signed at least twice.
        if (this.variables.orgPubKeys.length < signoffs.length) {
            return false;
        }

        const publicKeys = parent[0]
            ? [].concat(...parent.map((p) => p.publicKeys)).filter((val, idx, self) => {
                return self.indexOf(val) === idx;
            })
            : [...this.publicKeys];

        const id = this.getId();
        // verify that every signoff correspond to one and only one parent public key
        if (signoffs.length) {
            const message: Buffer = Buffer.from(id, ENCODING);
            const verifiedSignoffs: boolean[] = signoffs.map((s: string) => {
                for (const publicKey of publicKeys) {
                    if (this.verifySignoffWithPublicKey(s, publicKey, message)) {
                        publicKeys.splice(publicKeys.indexOf(publicKey), 1);
                        return true;
                    }
                }
                return false;
            });
            // false if there is some wrong signature (duplicate or from an unknown public key)
            return verifiedSignoffs.reduce((bool1, bool2) => bool1 && bool2);
        }

        return true;
    }

    verifySignoff(signoff: string, parent: GroupDefinition): boolean {
        if (!this.verifyId(parent)) {
            return false;
        }

        // check the signoff
        const message: Buffer = Buffer.from(this.getId(), ENCODING);
        for (const publicKey of parent.publicKeys) {
            if (this.verifySignoffWithPublicKey(signoff, publicKey, message)) {
                return true;
            }
        }

        return false;
    }

    verifySignoffWithPublicKey(signoff: string, publicKey: string, message: Buffer): boolean {
        const point: Point = Public.fromHex(publicKey).point;
        return schnorr.verify(this.suiteGroup, point, message, Buffer.from(signoff, ENCODING));
    }

    toJSON(): IGroupDefinition {
        // TODO find a solution for field "suite"
        return {
            orgPubKeys: this.variables.orgPubKeys,
            suite: this.variables.suite,
            voteThreshold: this.variables.voteThreshold,
            purpose: this.variables.purpose,
            predecessor: this.variables.predecessor ? this.variables.predecessor : undefined,
        };
    }

    getId(): string {
        const toH: Buffer = Buffer.from(JSON.stringify(this.toJSON()));
        return schnorr.hashSchnorr(this.suiteGroup, toH).marshalBinary().toString(ENCODING);
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

    private verifyId(parent: GroupDefinition): boolean {
        if (parent === undefined && !this.predecessor.length) {
            return true;
        }

        const parentId = parent.getId();
        const parentIdx = this.predecessor.indexOf(parentId);
        return parentIdx > -1;
    }
}
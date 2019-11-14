import { schnorr } from "@dedis/kyber/sign";
import { Public } from "./dynacred/KeyPair";
import { ENCODING, GroupDefinition } from "./groupDefinition";

export default class GroupDefinitionCollection {

    private collection: Map<string, GroupDefinition>; // key: contractID, value: GroupDefinition
    private purpose: string;

    constructor(purpose: string) {
        this.collection = new Map();
        this.purpose = purpose;
    }

    append(groupDefinition: GroupDefinition) {
        // only proceed if the the groupDefinition is sound
        if (!groupDefinition.verify()) {
            throw new Error("not verified");
        }

        // check if the contractID is not already there
        const existing: GroupDefinition[] = [];
        this.collection.forEach((gd: GroupDefinition) => {
            if (gd.id === groupDefinition.id) {
                existing.push(gd);
            }
        });

        if (existing.length) {
            groupDefinition.mergeSignatures(existing[0]);
            this.collection.set(groupDefinition.id, groupDefinition);
        } else {
            this.collection.set(groupDefinition.id, groupDefinition);
        }
    }

    has(groupDefinition: GroupDefinition): boolean {
        return this.collection.has(groupDefinition.id);
    }

    get(contractID: string): GroupDefinition {
        return this.collection.get(contractID);
    }

    getCurrentGroupDefinition(publicKey: Public): GroupDefinition {
        const sortedGroupDefinitions = Array.from(this.collection.values()).sort((gd1, gd2) => {
            if (gd1.creationTime < gd2.creationTime) {
                return 1;
            } else if (gd1.creationTime === gd2.creationTime) {
                return 0;
            } else {
                return -1;
            }
        });

        for (const gd of sortedGroupDefinitions) {
            if (gd.verify() && this.isValid(gd)) {
                if (gd.signatures.length) {
                    const message: Buffer = Buffer.from(gd.id, ENCODING);
                    for (const sig of gd.signatures) {
                        if (schnorr.verify(gd.suite, publicKey.point, message, Buffer.from(sig, ENCODING))) {
                            return gd;
                        }
                    }
                }
            }
        }

        return undefined;
    }

    // returns [gd] if there is no child to gd
    // returns [[gd,gd2], [gd,gd3]] if there is two children to gd
    getWorldView(groupDefinition: GroupDefinition) {
        const children = this.getChildren(groupDefinition);
        if (!children.length) {
            return [groupDefinition];
        } else {
            return children.map((c: GroupDefinition) => {
                return [].concat(...[groupDefinition].concat(this.getWorldView(c)));
            });
        }
    }

    getChildren(groupDefinition: GroupDefinition): GroupDefinition[] {
        return groupDefinition.successor.map((id: string) => this.collection.get(id));
    }

    // delegation of trust
    isValid(groupDefinition: GroupDefinition): boolean {
        // if groupDefinition is not included into the collection, append it
        if (!this.has(groupDefinition)) {
            this.append(groupDefinition);
        }

        if (groupDefinition.predecessor.length) {
            if (groupDefinition.predecessor.length === 1) {
                const parent: GroupDefinition = this.collection.get(groupDefinition.predecessor[0]);
                return (groupDefinition.signatures.length / parent.publicKeys.length) * 100 >= parent.voteThreshold;
            } else {
                // const parent: GroupDefinition = this.collection.get(group)

            }
        } else {
            // tslint:disable-next-line: max-line-length
            return (groupDefinition.signatures.length / groupDefinition.publicKeys.length) * 100 >= groupDefinition.voteThreshold;
        }
    }

    // private getCommonParent(...publicKeys: Public[]): GroupDefinition {

    // }
}

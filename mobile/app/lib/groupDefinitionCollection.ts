import { GroupDefinition } from "./groupDefinition";

export default class GroupDefinitionCollection {

    private collection: Map<string, GroupDefinition>; // key: contractID, value: GroupDefinition
    private purpose: string;
    // TODO useful?
    private rootID: string;
    private currentContractID: string;

    constructor(purpose: string) {
        this.collection = new Map();
        this.purpose = purpose;
    }

    append(groupDefinition: GroupDefinition) {
        // only proceed if the the groupDefinition is sound
        if (!groupDefinition.verify()) {
            throw new Error("not verified");
        }

        if (!this.rootID) {
            this.rootID = groupDefinition.id;
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

    // TODO
    // getLastGroupDefinition(): GroupDefinition[] {
    //     // TODO should I take into consideration the public key of the organizer calling this method to get the current groupDefinition?
    //     const lastGroupDefinition: GroupDefinition[] = [];
    //     this.collection.forEach((gd: GroupDefinition) => {
    //         if (!gd.successor.length) {
    //             let lastGD = gd;
    //             while (!lastGD.validate()) {
    //                 // normally should have only one predecessor
    //                 lastGD = this.collection.get(lastGD.predecessor[0]);
    //             }
    //             lastGroupDefinition.push(lastGD);
    //         }
    //     });

    //     return lastGroupDefinition;
    // }

    // TODO useful? Do it recursively
    getWorldView(groupDefinition: GroupDefinition) {
        const children = this.getChildren(groupDefinition);
        return children.map((c: GroupDefinition) => {
            return this.getWorldView(c).unshift(groupDefinition);
        });
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

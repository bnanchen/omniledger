import { Scalar, curve } from "@dedis/kyber";
import { GroupDefinition } from "./group/groupDefinition";

// Singleton class
export default class GroupDefinitionCollection {

    static getInstance(): GroupDefinitionCollection {
        if (!GroupDefinitionCollection.instance) {
            GroupDefinitionCollection.instance = new GroupDefinitionCollection();
        }

        return GroupDefinitionCollection.instance;
    }

    private static instance: GroupDefinitionCollection;
    private collection: Map<Scalar, GroupDefinition>; // key: contractID, value: GroupDefinition

    private constructor() {
        this.collection = new Map();
    }

    append(groupDefinition: GroupDefinition) {
        // only append if the the groupDefinition is sound
        if (!groupDefinition.verify()) {
            throw new Error("not verified");
        }

        // check if the contractID is not already there
        const existing: GroupDefinition[] = [];
        this.collection.forEach((gd: GroupDefinition) => {
            if (gd.contractID === groupDefinition.contractID) {
                existing.push(gd);
            }
        });

        if (!existing.length) {
            groupDefinition.mergeSignatures(existing[0]);
            this.collection.set(groupDefinition.contractID, groupDefinition);
        } else {
            this.collection.set(groupDefinition.contractID, groupDefinition);
        }
    }

    has(groupDefinition: GroupDefinition): boolean {
        return this.collection.has(groupDefinition.contractID);
    }

    get(contractID: Scalar): GroupDefinition {
        return this.collection.get(contractID);
    }

    getLastGroupDefinition(): GroupDefinition[] {
        // TODO should I take into consideration the public key of the organizer calling this method to get the current groupDefinition?
        const lastGroupDefinition: GroupDefinition[] = [];
        this.collection.forEach((gd: GroupDefinition) => {
            if (!gd.successor.length) {
                let lastGD = gd;
                while (!lastGD.validate()) {
                    // normally should have only one predecessor
                    lastGD = this.collection.get(lastGD.predecessor[0]);
                }
                lastGroupDefinition.push(lastGD);
            }
        });

        return lastGroupDefinition;
    }

    getChildren(groupDefinition: GroupDefinition): GroupDefinition[] {
        return groupDefinition.successor.map((id: Scalar) => this.collection.get(id));
    }
}

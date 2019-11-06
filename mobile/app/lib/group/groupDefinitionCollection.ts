    import { Scalar } from "@dedis/kyber";
    import { GroupDefinition } from "./groupDefinition";

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
            // check if the contractID is not already there
            const existing: GroupDefinition[] = [];
            this.collection.forEach((gd: GroupDefinition) => {
                if (gd.variables.contractID === groupDefinition.variables.contractID) {
                    existing.push(gd);
                }
            });

            if (!existing.length) {
                groupDefinition.mergeSignatures(existing[0]);
                this.collection.set(groupDefinition.variables.contractID, groupDefinition);
            } else {
                this.collection.set(groupDefinition.variables.contractID, groupDefinition);
            }
        }

        getLastGroupDefinition(): GroupDefinition[] {
            // TODO should I take into consideration the public key of the organizer calling this method to get the current groupDefinition?
            const lastGroupDefinition: GroupDefinition[] = [];
            this.collection.forEach((gd: GroupDefinition) => {
                if (!gd.variables.successor.length) {
                    lastGroupDefinition.push(gd);
                }
            });

            return lastGroupDefinition;
        }

        get(contractID: Scalar): GroupDefinition {
            return this.collection.get(contractID);
        }

        getChildren(groupDefinition: GroupDefinition): GroupDefinition[] {
            return groupDefinition.variables.successor.map((id: Scalar) => this.collection.get(id));
        }
    }

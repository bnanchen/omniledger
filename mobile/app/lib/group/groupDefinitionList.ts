import { GroupDefinition } from "./groupDefinition";

export class GroupDefinitionList {

    private list: GroupDefinition[];

    constructor() {
        this.list = [];
    }

    append(groupDefinition: GroupDefinition) {
        // check if the contractID is not already there
        const existing = this.list.filter((gd) =>  gd.variables.contractID === groupDefinition.variables.contractID);
        if (!existing.length) {
            groupDefinition.mergeSignatures(existing[0]);
            this.list[this.list.indexOf(existing[0])] = groupDefinition;
        } else {
            this.list.push(groupDefinition);
        }
    }

    getLastGroupDefinition(): GroupDefinition {


        return null;
    }
}
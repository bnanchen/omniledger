import { fromObject } from "tns-core-modules/data/observable/observable";
import { topmost } from "tns-core-modules/ui/frame/frame";
import { EventData, Page } from "tns-core-modules/ui/page/page";
import Log from "~/lib/cothority/log";
import { GroupContract } from "~/lib/group/groupContract";
import GroupContractCollection from "~/lib/group/groupContractCollection";
import { GroupDefinition, IGroupDefinition } from "~/lib/group/groupDefinition";
import { isAdmin, uData } from "~/lib/user-data";

let page: Page;
let gcCollection: GroupContractCollection;
const dataForm = fromObject({
    publicKeys: uData.keyIdentity._public.toHex() + ",fa19ecaa741b60fac42b5120229e3cea7cba1e8c045e8123531906a0d3e8f868",
    suite: "edwards25519",
    purpose: "Testing",
    voteThreshold: ">1/2",
    predecessor: "",
});
// const dataForm = fromObject({
//     publicKeys: "bonjour", //currentGroupContract ? currentGroupContract.groupDefinition.publicKeys[0] : [],
//     purpose: "bonjour", //currentGroupContract ? currentGroupContract.groupDefinition.purpose : "",
//     voteThreshold: "bonjour", //currentGroupContract ? currentGroupContract.groupDefinition.voteThreshold : ">50.0",
//     predecessor: "bonjour", //currentGroupContract ? currentGroupContract.groupDefinition.predecessor[0] : [],
// });

const viewModel = fromObject({
    dataForm,
    isAdmin,
    networkStatus: "",
});

// Event handler for Page "navigatingTo" event attached in identity.xml
export async function navigatingTo(args: EventData) {
    Log.print("new groupContract");
    page = args.object as Page;
    page.bindingContext = viewModel;
    dataForm.set("description", uData.contact.alias);
    // dataForm.set("publicKeys", "bonjour"); TODO pour update le form
}

export function goBack() {
    return topmost().goBack();
}

export async function propose() {
    Log.llvl1("propose new group contract");
    // TODO check the fields
    const variables: IGroupDefinition = {
        orgPubKeys: dataForm.get("publicKeys").split(","),
        suite: dataForm.get("suite"),
        voteThreshold: dataForm.get("voteThreshold"),
        purpose: dataForm.get("purpose"),
        predecessor: dataForm.get("predecessor"),
    };
    let groupDefinition = new GroupDefinition(variables);
    let contract: GroupContract;
    if (!gcCollection) {
        gcCollection = new GroupContractCollection(variables.purpose);
        // genesis group contract: c0
        contract = gcCollection.createGroupContract(undefined, groupDefinition);
        // group contract: c1
        groupDefinition = new GroupDefinition(groupDefinition.allVariables);
        contract = gcCollection.createGroupContract(contract, groupDefinition);
        gcCollection.sign(contract, uData.keyIdentity._private);
    }

    return topmost().navigate({
        moduleName: "pages/lab/group/group-page",
        context: {
            gcCollection,
        },
    });
}

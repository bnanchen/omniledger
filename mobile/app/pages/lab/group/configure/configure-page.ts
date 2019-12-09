import { topmost } from "tns-core-modules/ui/frame/frame";
import { EventData, Page } from "tns-core-modules/ui/page/page";
import Log from "~/lib/cothority/log";
import { fromObject } from "tns-core-modules/data/observable/observable";
import { gcCollection, groupContractId } from "../group-page";

let page: Page;
const currentGroupContract = gcCollection.get(groupContractId);
console.log(currentGroupContract);

const dataGroupContract = fromObject({
    publicKeys: currentGroupContract ? currentGroupContract.groupDefinition.publicKeys : [],
    purpose: currentGroupContract ? currentGroupContract.groupDefinition.purpose : "",
    voteThreshold: currentGroupContract ? currentGroupContract.groupDefinition.voteThreshold : ">50.0",
    predecessor: currentGroupContract ? currentGroupContract.groupDefinition.predecessor : [],
});

// Event handler for Page "navigatingTo" event attached in identity.xml
export async function navigatingTo(args: EventData) {
    Log.print("new groupContract");
    page = args.object as Page;
    // TODO certainly have to be updated
}

export function goBack() {
    return topmost().goBack();
}

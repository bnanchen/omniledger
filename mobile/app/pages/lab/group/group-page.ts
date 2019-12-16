/*
In NativeScript, a file with the same name as an XML file is known as
a code-behind file. The code-behind is a great place to place your view
logic, and to set up your page’s data binding.
*/

import { EventData } from "tns-core-modules/data/observable";
import * as dialogs from "tns-core-modules/ui/dialogs";
import { topmost } from "tns-core-modules/ui/frame/frame";
import { GestureEventData } from "tns-core-modules/ui/gestures/gestures";
import { Page } from "tns-core-modules/ui/page";
import { GroupContract } from "~/lib/group/groupContract";
import GroupContractCollection from "~/lib/group/groupContractCollection";
import { msgFailed } from "~/lib/messages";
import { scan } from "~/lib/scan";
import { uData } from "~/lib/user-data";
import { GroupListView, GroupView } from "~/pages/lab/group/group-view";

// QR code utilies
const ZXing = require("nativescript-zxing");
const QrGenerator = new ZXing();

export let groupList: GroupListView;
let page: Page;
const gcCollection: GroupContractCollection[] = [];

// Event handler for Page "navigatingTo" event attached in identity.xml
export async function navigatingTo(args: EventData) {
    // console.log(uData.groups);
    console.log(uData.keyIdentity._public.toHex());
    page = args.object as Page;
    // if (!page.navigationContext.gcCollection) {
        gcCollection.push(page.navigationContext.gcCollection as GroupContractCollection);
    // }
    groupList = new GroupListView(gcCollection);
    console.log("groupList", groupList);
    page.bindingContext = groupList;
    groupList.updateGroupList(gcCollection);
}

export async function createGroup(args: GestureEventData) {
    const propose = "Design a group definition";
    const scanQr = "Scan a group contract";
    const actions = [propose, scanQr];
    const cancel = "Cancel";

    try {
        const action = await dialogs.action({
            message: "How do you want to create a new group",
            cancelButtonText: cancel,
            actions,
        });

        switch (action) {
            case cancel:
                break;
            case propose:
                return topmost().navigate({
                    moduleName: "pages/lab/group/configure/configure-page",
                });
            case scanQr:
                const gcCollection = new GroupContractCollection();
                await gcCollection.scanNewGroupContract(uData.keyIdentity);
                // const result = await scan("{{ L('group.camera_text') }}");
                // console.log("bonjour");
                // const groupContract = GroupContract.createFromJSON(JSON.parse(result.text));
                // console.log("aurevoir");
                // // cannot accept a group contract where the user public key is not included
                // if (groupContract.groupDefinition.publicKeys.indexOf(uData.keyIdentity._public.toHex()) === -1) {
                //     throw new Error("This group contract does not contain your public key.");
                // }
                // // not yet aware of this group contract
                // const options = {
                //     title: "Do you want to accept this new group contract?",
                //     message: groupContract.groupDefinition.toString(),
                //     okButtonText: "Yes",
                //     cancelButtonText: "No",
                // };
                // dialogs.confirm(options).then((choice: boolean) => {
                //     if (choice) {
                //         console.log("1");
                //         const coll = new GroupContractCollection(groupContract.groupDefinition.purpose);
                //         console.log("2");
                //         gcCollection.push(coll);
                //         console.log("3");
                //         coll.append(groupContract);
                //         console.log("4");
                //         coll.sign(groupContract, uData.keyIdentity._private);
                //         console.log("5");
                //         console.log(groupList);
                //         groupList.updateGroupList(gcCollection);
                //         console.log("6");
                //     }
                // });
                break;
        }
    } catch (e) {
        await msgFailed(e.toString(), "Error");
    }
}

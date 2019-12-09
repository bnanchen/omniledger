/*
In NativeScript, a file with the same name as an XML file is known as
a code-behind file. The code-behind is a great place to place your view
logic, and to set up your page’s data binding.
*/

import { EventData } from "tns-core-modules/data/observable";
import { fromNativeSource, ImageSource } from "tns-core-modules/image-source/image-source";
import { screen } from "tns-core-modules/platform";
import { topmost } from "tns-core-modules/ui/frame/frame";
import { Page } from "tns-core-modules/ui/page";
import { TextView } from "tns-core-modules/ui/text-view";
import Log from "~/lib/cothority/log";
import { scan } from "~/lib/scan";
import { GroupView } from "~/pages/lab/group/group-view";
import * as dialogs from "tns-core-modules/ui/dialogs";
import { GroupContract } from "~/lib/group/groupContract";
import GroupContractCollection from "~/lib/group/groupContractCollection";
import { GroupDefinition, IGroupDefinition } from "~/lib/group/groupDefinition";
import { GestureEventData } from "tns-core-modules/ui/gestures/gestures";

export const gcCollection = new GroupContractCollection("Testing");
export let groupContractId: string = undefined; // TODO to be erased
export let elements: GroupView;
const ZXing = require("nativescript-zxing");
const QrGenerator = new ZXing();
let page: Page;

// Event handler for Page "navigatingTo" event attached in identity.xml
export async function navigatingTo(args: EventData) {
    page = args.object as Page;
    elements = new GroupView();
    page.bindingContext = elements;
}

export async function configureGroupContract(args: GestureEventData) {
    return topmost().navigate({
        moduleName: "pages/lab/group/configure/configure-page",
    });
}

export function createQr() {
    const gcCollection = new GroupContractCollection("testing");
    const variables: IGroupDefinition = {
        purpose: "testing",
        voteThreshold: "30%",
        suite: "edwards25519",
        orgPubKeys: [],
    };
    const groupDefinition = new GroupDefinition(variables);
    const groupContract = gcCollection.createGroupContract(undefined, groupDefinition);
    groupContractId = groupContract.id;
    const sideLength = screen.mainScreen.widthPixels / 4;
    const qrcode = QrGenerator.createBarcode({
        encode: JSON.stringify(groupContract.toJSON()),
        format: ZXing.QR_CODE,
        height: sideLength,
        width: sideLength,
    });

    // show QrCode
    topmost().showModal("pages/modal/modal-key", fromNativeSource(qrcode),
    () => { Log.print("ok"); }, false, false, false);
}

export async function readQr() {
    try {
      while (true) {
          await addScan();
          return;
      }
    } catch (e) {
        Log.print("pas cool");
    }
}

async function addScan() {
    try {
      const result = await scan("{{ L('group.camera_text') }}");
      // show QrCode content
      const gcCollection = new GroupContractCollection("testing");
      const groupContract = GroupContract.createFromJSON(JSON.parse(result.text));
      gcCollection.append(groupContract);
      groupContractId = groupContract.id;
      dialogs.alert({
          title: "Content of the QR Code",
          message: JSON.stringify(gcCollection.get(groupContract.id)),
          okButtonText: "OK",
      }).then(() => {
          console.log("Dialog closed!");
      });
      // topmost().showModal("pages/modal/modal-key", resultText,
      // () => { Log.print("ok"); }, false, false, false);
    } catch (e) {
        Log.print(e);
    }
}

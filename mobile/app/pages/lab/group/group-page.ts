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

export function createQr() {
    const json = {
        contractID: "Hash(orgPubKeyList | voteThresh | predecessor | creationTime)",
        numbOrganizer: 3,
        orgPubKeyList: ["PubA", "PubB", "PubC"],
        voteThresh: 33.3,
        // tslint:disable-next-line: object-literal-sort-keys
        orgSignatures: ["SigA(contractID)", "SigB(contractID)", "SigC(contractID)"],
        successor: null,
        predecessor: "c0’s contractID",
        creationTime: "2019-10-19T23:15:30.000Z",
    };
    const sideLength = screen.mainScreen.widthPixels / 4;
    const qrcode = QrGenerator.createBarcode({
        encode: JSON.stringify(json),
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
      dialogs.alert({
        title: "Content of the QR Code",
        message: result.text,
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

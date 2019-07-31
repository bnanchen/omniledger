/*
In NativeScript, a file with the same name as an XML file is known as
a code-behind file. The code-behind is a great place to place your view
logic, and to set up your page’s data binding.
*/

require("nativescript-nodeify");

import * as application from "tns-core-modules/application";
import { EventData, fromObject } from "tns-core-modules/data/observable";
import * as dialogs from "tns-core-modules/ui/dialogs";
import { getFrameById, Page } from "tns-core-modules/ui/frame";
import { SelectedIndexChangedEventData, TabView } from "tns-core-modules/ui/tab-view";
import Log from "~/lib/cothority/log";
import { Roster, WebSocketAdapter } from "~/lib/cothority/network";
import { setFactory } from "~/lib/cothority/network/connection";
import { Defaults } from "~/lib/dynacred/Defaults";
import { msgFailed } from "~/lib/messages";
import { NativescriptWebSocketAdapter } from "~/lib/nativescript-ws";
import { switchHome } from "~/pages/home/home-page";
import { switchIdentity } from "~/pages/identity/identity-page";
import { switchLab } from "~/pages/lab/lab-page";
import { switchSettings } from "~/pages/settings/settings-page";
import { uData } from "~/user-data";

declare const exit: (code: number) => void;

export let mainView = fromObject({showGroup: 0});

// Verify if we already have data or not. If it's a new installation, present the project
// and ask for an alias, and set up keys.
export async function navigatingTo(args: EventData) {
    try {
        Log.lvl2("navigatingTo: main-page");
        let page = <Page> args.object;
        page.bindingContext = mainView;
        setFactory((path: string): WebSocketAdapter => new NativescriptWebSocketAdapter(path));
        activateTesting();
        Log.lvl1("loading");
        await uData.load();
        if (!uData.contact.alias || uData.contact.alias == "new identity") {
            return mainViewRegister(args);
        }
        return mainViewRegistered(args);
    } catch (e) {
        Log.catch("couldn't load:", e);
        if (Defaults.Testing) {
          // During testing, it is common to be unable to connect, and to want to
          // create a new ledger.
          return mainViewRegister(args);
        }
        await msgFailed("Error when setting up communication: " + e.toString());
        let again = await dialogs.confirm({
            title: "Network error",
            message: "Do you want to try again?",
            okButtonText: "Try again",
            cancelButtonText: "Quit",
        });
        if (again) {
            await navigatingTo(args);
        } else {
            if (Defaults.Testing){
                uData.delete();
                return mainViewRegister(args);
            }
            if (application.android) {
                application.android.foregroundActivity.finish();
            } else {
                exit(0);
            }
        }
    }
}

export function mainViewRegistered(args: any) {
    Log.lvl1("mainViewRegistered");
    mainView.set("showGroup", 2);
    let tv = <TabView> getFrameById("app-root").getViewById("mainTabView");
    tv.selectedIndex = 0;
    return switchHome(args);
}

export function mainViewRegister(args: any) {
    Log.lvl1("mainViewRegister");
    mainView.set("showGroup", 1);
    return getFrameById("setup").navigate("pages/setup/1-present");
}

export async function onChangeTab(args: SelectedIndexChangedEventData) {
    Log.lvl2("onchangetab", args.newIndex);
    switch (args.newIndex) {
        case 0:
            await switchHome(args);
            break;
        case 1:
            await switchIdentity(args);
            break;
        case 2:
            await switchLab(args);
            break;
        case 3:
            await switchSettings(args);
            break;
    }
}

export function activateTesting() {
    Defaults.Testing = true;
    // *******
    //
    // Paste in config info here to sync two emulators to the same byzcoin.
    //
    // *******

    Defaults.ByzCoinID = Buffer.from("95369233278a0481302b2288a2b4dfe7aa9a59310b401c4bb9487377cca547bc", "hex");
    Defaults.SpawnerID = Buffer.from("9065685855232fd7b8c5d79568ba2094bcea7c87c9018f7a98f680bc234c6624", "hex");

    Defaults.Roster = Promise.resolve(Roster.fromTOML(`[[servers]]
  Address = "tls://192.168.100.1:7776"
  Suite = "Ed25519"
  Public = "ed2494dfd826cd2c2ea23adedf564fb19619c6004bff91f08bc76e80bdb4ec7f"
  Description = "Conode_4"
  [servers.Services]
    [servers.Services.ByzCoin]
      Public = "01dc5f40cae57758c6e7200106d5784f6bcb668959ddfd2f702f6aed63e47e3a6d90a61899a315b6fccaec991a4f2807d4fedce0b53c125c2005d34e0c1b4a9478cf60c1e5ab24a1e4ab597f596b4e2ba06af19cc3e5589bda58030a0f70f8208abfeeb072e04a87c79f2f814634257be9b0be4f9b8b6a927abcdfab099bc16c"
      Suite = "bn256.adapter"
    [servers.Services.Skipchain]
      Public = "3ff215e1755712e28f8f4d60ca412101c60d3707a68f68b37cf6c29437cc315c79ab1190fa941309e50dee30eeb677e6f2b8796f01d99a866c24dd5dd59594840dd387970c6eaaf6b56c8f8055c7c9d65f3a82e1bfc3bb7efb80d5faa9c33ff35099a96c9dbd32e65e3448f78693d00b346400796629229432161e1044b0af5f"
      Suite = "bn256.adapter"
[[servers]]
  Address = "tls://192.168.100.1:7774"
  Suite = "Ed25519"
  Public = "0a0bdbb3f4059e9dad2d92b967bde211865f7d00839abd3330d8c9c4423b10bc"
  Description = "Conode_3"
  [servers.Services]
    [servers.Services.ByzCoin]
      Public = "6ea7db10d9f93b36045203d4008501f30a80d7c177847a784b483dcf6fdcfbe47e9f0123093ca3d715307662a642c684a3884656fc75c04d16f3cb1db67cd9e12f8c5ea637d124e1824522ce445f2848763bf3962b05ee662eafb78ac8ddd3b8771bccc8e920287857f56eabe094e5962f201a11f1f2c8ab388ff47dcb2e1f7a"
      Suite = "bn256.adapter"
    [servers.Services.Skipchain]
      Public = "58eaa4086f9033bb6398a8d4a6e6a7c136aa19e85c452f0ae069eb5a008e220305f726a056451ae0cb2c8deec820d6b5ad6585684122c38199403fa49bafeda06734432240cac370d70a5be9799258d044fb04f6aa634fed5d4c7080b340e08359142bbbd602323924ee97db1dbf6e3fb19b941880156cb98552fbe957115743"
      Suite = "bn256.adapter"
[[servers]]
  Address = "tls://192.168.100.1:7772"
  Suite = "Ed25519"
  Public = "5f1a868b2dfa1e799c958a2dd5d850a660e3596a5ceb4fe7ff9dcf9c2efd419b"
  Description = "Conode_2"
  [servers.Services]
    [servers.Services.ByzCoin]
      Public = "70208fdcbaa6f3fa539380d5b19d7318a1c8ae46aa8af1d17e2d321afbda46397654fd72432f2050689f3c942801fe9e2e401d73c1accae8b7f683c0a261c57469937eb409864b1d9c0ed5fd012ec0b4fa835b92c12770e5b3cd5b900528fa9b1b6672b9121d68b4f98fd238918c96c31643271d2ac0fdb54af15dabfd772f6c"
      Suite = "bn256.adapter"
    [servers.Services.Skipchain]
      Public = "7dafa5bc547beb1ecb26267df3b5294e1a641c356d1039cc5c94acc0048a56fb2e2d6dc7507291cf4fe03418e1e16f0810637a67e9a31edf8d06cca399f0f5c85e3dbe740bd564968467b0cc1792688791bd59a61eb98723ab30ab3f784e2225054437110ea972c43f633dc510fd07d50871ec346ee1c088e5441d415dd9e95e"
      Suite = "bn256.adapter"
[[servers]]
  Address = "tls://192.168.100.1:7770"
  Suite = "Ed25519"
  Public = "3de71200e7ecaeb49dc7f824317fb4ef6890e90018c49617139b6e61075f0247"
  Description = "Conode_1"
  [servers.Services]
    [servers.Services.ByzCoin]
      Public = "7ab3a36be090002cf36a82bc606d6b0ef1c4432abae0c432c0ab02c9c0d5b2513c6f18625f847aef2d49a57fe5adaea103ba48dc60e9b4dd51f1beecce2b0a2f763a25ca4e2a460b20fd3e80e0d9d306b760cd9c715ecbc77047e875f32dc8435ee5ceb8910a1290827d4fbf61483aa7758c81f83ab9a8ca58fc8a6b1c0f1d5b"
      Suite = "bn256.adapter"
    [servers.Services.Skipchain]
      Public = "0524681253b82af55c0976e792014707c39405fe215bb1ebf6a3159dcbbb944535619f32ed4a91a4d1fcf4d9aa4ad14a1d349d5354dbbd6fb51907087a09ce7862ee5808a4c3f5b3b23ee631f1ce42b56107acec13fa06817263d1e7f77938f1149249e598fd24207e7e5e33ece750d36fe966faf8fda9c7ace13a6a8b0b9fa4"
      Suite = "bn256.adapter"
`));
}

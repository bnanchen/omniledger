import Log from "~/lib/cothority/log";
import {GestureEventData} from "tns-core-modules/ui/gestures";
import { EventData, Frame, getFrameById, topmost } from "tns-core-modules/ui/frame";
import {SelectedIndexChangedEventData} from "tns-core-modules/ui/tab-view";

export let frame: Frame;

export function navigatingToIdentity(args: EventData){
    Log.lvl2("Navigating to identity");
}

export function goIdentity(args: GestureEventData) {
    frame = args.view.page.frame;
    return frame.navigate({
        moduleName: "pages/identity/attributes/attributes-page",
    })
}

export function goFriends(args: GestureEventData) {
    frame = args.view.page.frame;
    return frame.navigate({
        moduleName: "pages/identity/contacts/contacts-page",
    })
}

export function goRecover(args: GestureEventData) {
    frame = args.view.page.frame;
    return frame.navigate({
        moduleName: "pages/identity/recover/recover-page",
    })
}

export async function switchIdentity(args: SelectedIndexChangedEventData) {
    try {
        if (frame) {
            let ret = await frame.navigate("pages/identity/identity-page");
            frame = null;
            return ret;
        }
    } catch (e) {
        Log.catch(e);
    }
}


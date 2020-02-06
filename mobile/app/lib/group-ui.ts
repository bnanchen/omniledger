import Log from "@c4dt/cothority/log";
import { KeyPair } from "@c4dt/dynacred";
import { GroupContract, GroupContractCollection } from "@c4dt/dynacred";
import { localize } from "nativescript-localize";
import { fromNativeSource } from "tns-core-modules/image-source/image-source";
import { screen } from "tns-core-modules/platform";
import * as dialogs from "tns-core-modules/ui/dialogs";
import { topmost } from "tns-core-modules/ui/frame/frame";
import { uData } from "~/lib/byzcoin-def";
import { scan } from "~/lib/scan";
import { msgFailed } from "./messages";

/**
 * scan a QR code representing a group contract
 * and add it to a group contract collection
 *
 * @param gcCollection the collection in which add the scanned group contract
 * @param kp pair of public and private keys
 */
export async function scanNewGroupContract(
    gcCollection: GroupContractCollection,
    kp: KeyPair): Promise<GroupContractCollection> {
    try {
        const result = await scan("{{ L('group.camera_text') }}");
        const groupContract = GroupContract.createFromJSON(JSON.parse(result.text));

        if (gcCollection.get(groupContract.id)) {
            // already existing group contract
            gcCollection.append(groupContract);
        } else if (groupContract.groupDefinition.publicKeys.indexOf(kp._public.toHex()) === -1) {
            // cannot accept a group contract where the user public key is not included
            // check if the organizer was removed
            let isRemoved = false;
            const parents = gcCollection.getParent(groupContract);
            if (parents) {
                for (const parent of parents) {
                    if (parent.publicKeys.indexOf(kp._public.toHex()) > -1) {
                        isRemoved = true;
                        break;
                    }
                }
            }

            if (isRemoved) {
                const accept = localize("dialog.accept");
                const keep = localize("dialog.keep");
                const dismiss = localize("dialog.dismiss");
                const message = await getMessage(groupContract, gcCollection.getCurrentGroupContract());
                // tslint:disable: object-literal-sort-keys
                const action = {
                    title: localize("group.removed_organizer"),
                    message,
                    okButtonText: accept,
                    neutralButtonText: keep,
                    cancelButtonText: dismiss,
                };
                await dialogs.action(action).then((r: string) => {
                    switch (r) {
                        case accept:
                            gcCollection.purpose = groupContract.groupDefinition.purpose;
                            gcCollection.append(groupContract);
                            gcCollection.sign(groupContract, kp._private);
                            break;
                        case keep:
                            gcCollection.purpose = groupContract.groupDefinition.purpose;
                            gcCollection.append(groupContract, true);
                            break;
                    }
                });
            } else {
                const options = {
                    title: localize("group.not_contain_your_pk"),
                    message: groupContract.groupDefinition.toString(),
                    okButtonText: localize("dialog.yes"),
                    cancelButtonText: localize("dialog.no"),
                };
                await dialogs.confirm(options).then((choice: boolean) => {
                    if (choice) {
                        gcCollection.purpose = groupContract.groupDefinition.purpose;
                        gcCollection.append(groupContract, true);
                        if (groupContract.predecessor.length > 0 && !gcCollection.isAccepted(groupContract)) {
                            gcCollection.removeProposedGroupContract();
                            dialogs.alert(localize("group.follower_cannot_add_proposed"));
                        }
                    }
                });
            }
        } else {
            // not yet aware of this group contract
            if (!groupContract.groupDefinition.predecessor.length) {
                // a user can only accept or not the genesis group contract
                const options = {
                    title: localize("group.accept_group_contract"),
                    message: groupContract.groupDefinition.toString(),
                    okButtonText: localize("dialog.yes"),
                    cancelButtonText: localize("dialog.no"),
                };
                await dialogs.confirm(options).then((choice: boolean) => {
                    if (choice) {
                        gcCollection.purpose = groupContract.groupDefinition.purpose;
                        gcCollection.append(groupContract);
                    }
                });
            } else {
                const accept = localize("dialog.accept");
                const keep = localize("dialog.keep");
                const dismiss = localize("dialog.dismiss");
                const message = await getMessage(groupContract, gcCollection.getCurrentGroupContract());
                const parents = gcCollection.getParent(groupContract);
                let canVote = false;
                parents.forEach((p: GroupContract) => {
                    canVote = p.publicKeys.indexOf(kp._public.toHex()) > -1;
                });
                const options = {
                    title: localize("group.how_handle_group_contract"),
                    message,
                    okButtonText: canVote ? accept : "",
                    neutralButtonText: keep,
                    cancelButtonText: dismiss,
                };

                await dialogs.confirm(options).then((r: boolean) => {
                    switch (r) {
                        case true:
                            gcCollection.purpose = groupContract.groupDefinition.purpose;
                            gcCollection.append(groupContract);
                            gcCollection.sign(groupContract, kp._private);
                            break;
                        case undefined:
                            let keepOnly = true;
                            if (!canVote && !gcCollection.getCurrentGroupContract()) {
                                keepOnly = false;
                            }

                            gcCollection.purpose = groupContract.groupDefinition.purpose;
                            gcCollection.append(groupContract, keepOnly);
                            break;
                    }
                });
            }
        }

        return gcCollection;

    } catch (e) {
        await msgFailed(e.toString(), "Error");
    }
}

/**
 * Display a QR code representing a group contract
 *
 * @param groupContract
 */
export function showQR(groupContract: GroupContract) {
    // QR code utilies
    // tslint:disable: variable-name
    const ZXing = require("nativescript-zxing");
    const QrGenerator = new ZXing();

    const qrVariables = {
        groupDefinition: groupContract.groupDefinition.toJSON(),
        signoffs: groupContract.signoffs,
    };
    const sideLength = screen.mainScreen.widthPixels / 2;
    const qrCode = QrGenerator.createBarcode({
        encode: JSON.stringify(qrVariables),
        format: ZXing.QR_CODE,
        height: sideLength,
        width: sideLength,
    });

    topmost().showModal("pages/modal/modal-group", fromNativeSource(qrCode),
        () => { Log.print("QR code scanned"); }, false, false, false);
}

/**
 * Find an alias for a specific publicKey
 *
 * @param publicKey
 */
export function getAliasFromPublicKey(publicKey: string, devicesPerContacts: any[][]): string | undefined {
    try {
        for (let i = 0; i < devicesPerContacts.length; i++) {
            for (const device of devicesPerContacts[i]) {
                if (publicKey === device.pubKey.toHex()) {
                    return uData.contacts[i].alias;
                }
            }
        }

        return undefined;
    } catch (e) {
        msgFailed(e.toString(), "Error");
    }
}

/**
 * Returns the difference between the proposed and the current group contracts
 * in the form of a string
 *
 * @param proposed the proposed group contract
 * @param current the current group contract
 * @returns {string} the difference between the two group contracts
 */
async function getMessage(proposed: GroupContract, current: GroupContract): Promise<string> {
    if (current === undefined) {
        return proposed.groupDefinition.toString();
    }

    let message = "";
    if (proposed.purpose !== current.purpose) {
        message += "\nThe purpose has been modified: " + proposed.purpose;
    }
    if (proposed.voteThreshold !== current.voteThreshold) {
        message += "\nThe vote threshold has been modified: " + proposed.voteThreshold;
    }
    if (!proposed.publicKeys.every((pk) => current.publicKeys.includes(pk))) {
        const promises = [];
        for (const contact of uData.contacts) {
            promises.push(contact.getDevices());
        }
        const devicesPerContacts = await Promise.all(promises);

        // check if there is a new organizer
        const newPubKey = proposed.publicKeys.filter((pk) => !current.publicKeys.includes(pk));
        if (newPubKey.length > 0) {
            for (const pubKey of newPubKey) {
                message += "\nNew organizer: " + getAliasFromPublicKey(pubKey, devicesPerContacts);
            }
        }

        // check if there is less organizer
        const remOrg = current.publicKeys.filter((pk) => !proposed.publicKeys.includes(pk));
        if (remOrg.length > 0) {
            for (const org of remOrg) {
                message += "\nRemoved organizer: " + getAliasFromPublicKey(org, devicesPerContacts);
            }
        }
    }

    return message;
}

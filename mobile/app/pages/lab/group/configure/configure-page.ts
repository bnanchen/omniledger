import Log from "@dedis/cothority/log";
import { ObservableArray } from "tns-core-modules/data/observable-array";
import { fromObject, fromObjectRecursive } from "tns-core-modules/data/observable/observable";
import * as dialogs from "tns-core-modules/ui/dialogs";
import { topmost } from "tns-core-modules/ui/frame/frame";
import { EventData, Page } from "tns-core-modules/ui/page/page";
import { isAdmin, uData } from "~/lib/byzcoin-def";
import { Contact } from "~/lib/dynacred";
import { GroupContract } from "~/lib/dynacred/group/groupContract";
import { GroupContractCollection } from "~/lib/dynacred/group/groupContractCollection";
import { GroupDefinition, IGroupDefinition } from "~/lib/dynacred/group/groupDefinition";
import { msgFailed } from "~/lib/messages";

let page: Page;
let gcCollection: GroupContractCollection;
const publicKeyList = new ObservableArray<PublicKeyListItem>();
const predecessorList = new ObservableArray<PredecessorListItem>();

// tslint:disable: object-literal-sort-keys
const dataForm = fromObject({
    publicKeys: uData.keyIdentity._public.toHex() + ",17898659d4e9744ff23a49daecdff2d6f68dba985adaef19e84744d94198356b,d2b034bb987fb01a35d25d3c89f674ba01b512b1a2f4f3a673f78194ec798edc",
    suite: "edwards25519",
    purpose: "Testing",
    voteThreshold: ">1/2",
    predecessor: "",
});

const dataFormDetails = fromObject({
    id: "",
    signoffs: "",
});

const viewModel = fromObjectRecursive({
    dataForm,
    dataFormDetails,
    isAdmin,
    isReadOnly: false,
    publicKeyList,
    predecessorList,
});

// Event handler for Page "navigatingTo" event attached in identity.xml
export async function navigatingTo(args: EventData) {
    Log.lvl1("new groupContract");
    page = args.object as Page;

    publicKeyList.splice(0);
    predecessorList.splice(0);

    if (page.get("navigationContext")) {
        if ("isReadOnly" in page.navigationContext) {
            viewModel.set("isReadOnly", page.navigationContext.isReadOnly);
        }
        if ("id" in page.navigationContext) {
            dataFormDetails.set("id", page.navigationContext.id);
        }
        if ("groupContract" in page.navigationContext) {
            gcCollection = page.navigationContext.gcCollection;
            setDataForm(page.navigationContext.groupContract);
        } else {
            setDataForm();
        }
    }

    page.bindingContext = viewModel;

    // if (page.get("navigationContext")) {
    //     if ("isReadOnly" in page.navigationContext) {
    //         viewModel.set("isReadOnly", page.navigationContext.isReadOnly);
    //     }
    //     if ("groupContract" in page.navigationContext) {
    //         gcCollection = page.navigationContext.gcCollection;
    //         const groupContract = page.navigationContext.groupContract;
    //         dataForm.set("publicKeys", groupContract.publicKeys.join(","));
    //         dataForm.set("suite", groupContract.groupDefinition.suite);
    //         dataForm.set("purpose", groupContract.purpose);
    //         dataForm.set("voteThreshold", groupContract.voteThreshold);
    //         dataForm.set("predecessor", groupContract.predecessor ? groupContract.predecessor.join(",") : "");
    //         dataForm.set("description", groupContract.purpose);
    //     }
    //     if ("predecessor" in page.navigationContext) {
    //         dataForm.set("predecessor", page.navigationContext.predecessor);
    //         gcCollection = page.navigationContext.gcCollection;
    //         // console.log("pred", page.navigationContext.predecessor);
    //         predecessorList.push({
    //             alias: page.navigationContext.predecessor.slice(0, 5),
    //             id: page.navigationContext.predecessor,
    //         });
    //     } else {
    //         gcCollection = undefined;
    //     }
    //     if ("id" in page.navigationContext) {
    //         dataFormDetails.set("id", page.navigationContext.id);
    //     }
    // }
    // publicKeyList.push(uData.contact);
    // page.bindingContext = viewModel;
}

export function goBack() {
    return topmost().goBack();
}

export async function propose() {
    Log.llvl1("propose new group contract");
    // TODO check the fields
    // tslint:disable: object-literal-sort-keys
    const variables: IGroupDefinition = {
        orgPubKeys: publicKeyList.map((p) => p.publicKey),
        suite: dataForm.get("suite"),
        voteThreshold: dataForm.get("voteThreshold"),
        purpose: dataForm.get("purpose"),
        predecessor:  predecessorList.map((p) => p.id),
    };

    let groupDefinition = new GroupDefinition(variables);
    let contract: GroupContract;
    if (!gcCollection) {
        Log.print("new", groupDefinition.purpose);
        gcCollection = new GroupContractCollection(variables.purpose);
        // genesis group contract: c0
        contract = gcCollection.createGroupContract(undefined, groupDefinition);
        // group contract: c1
        groupDefinition = new GroupDefinition(groupDefinition.allVariables);
        contract = gcCollection.createGroupContract(contract, groupDefinition);
        gcCollection.sign(contract, uData.keyIdentity._private);
    } else {
        Log.print("gcCollection", gcCollection);
        if (groupDefinition.isSimilarTo(gcCollection.getCurrentGroupContract().groupDefinition)) {
            dialogs.alert({
                title: "Warning",
                message: "A proposed contract needs to be different from its predecessor(s).",
                okButtonText: "Ok",
            });
            return;
        }
        contract = gcCollection.createGroupContract(gcCollection.getCurrentGroupContract(), groupDefinition);
        gcCollection.sign(contract, uData.keyIdentity._private);
    }

    // save the new groupContractCollection
    uData.addGroup(gcCollection);
    await uData.save();

    return topmost().navigate({
        moduleName: "pages/lab/group/group-page",
    });
}

export async function addPublicKey(args: any) {
    try {
        const contactAliases = uData.contacts.map((c) => c.alias).filter((a) => {
            return publicKeyList.map((p: PublicKeyListItem) => p.alias).indexOf(a) === -1;
        });
        const cancelText = "Cancel";
        let result = await dialogs.action({
            title: "Choose an organizer",
            cancelButtonText: cancelText,
            actions: contactAliases,
        });

        if (result === cancelText) {
            return;
        }

        const contact = uData.contacts.find((c) => {
            return c.alias === result;
        });

        if (contact !== null) {
            const devices = await contact.getDevices();
            const pubKeys = devices.map((d) => d.pubKey.toHex());
            // TODO if there is multiple public key need to choose!
            let selectedPubKey: string;
            if (pubKeys.length > 1) {
                result = await dialogs.action({
                    title: "Which public key do you want to use?",
                    cancelButtonText: cancelText,
                    actions: pubKeys,
                });

                if (result === cancelText) {
                    return;
                }

                selectedPubKey = pubKeys.find((pk) => result === pk);
            } else {
                selectedPubKey = pubKeys[0];
            }

            publicKeyList.push(new PublicKeyListItem(contact.alias, selectedPubKey));
        }
    } catch (e) {
        Log.catch("error");
        return msgFailed(e.toString(), "Error");
    }
}

export async function addPredecessor(args: any) {
    try {
        if (gcCollection === undefined || gcCollection.collection.size === 0) {
            await dialogs.alert("There is no possible predecessor available.");
            return;
        }

        const gcIds = Array.from(gcCollection.collection.keys()).filter((id) => {

            return predecessorList.map((p: PredecessorListItem) => p.id).indexOf(id) === -1;
        });
        const cancelText = "Cancel";
        const result = await dialogs.action({
            title: "Choose a predecessor",
            cancelButtonText: cancelText,
            actions: gcIds,
        });

        if (result === cancelText) {
            return;
        }

        const selectedId = gcIds.find((id: string) => {
            return id === result;
        });
        if (selectedId !== null) {
            predecessorList.push(new PredecessorListItem(selectedId));
        }
    } catch (e) {
        msgFailed(e.toString(), "Error");
    }
}

async function setDataForm(groupContract?: GroupContract) {
    if (groupContract) {
        dataForm.set("publicKeys", groupContract.publicKeys.join(","));
        dataForm.set("suite", groupContract.groupDefinition.suite);
        dataForm.set("purpose", groupContract.purpose);
        dataForm.set("voteThreshold", groupContract.voteThreshold);

        // set publicKeyList
        // TODO first add the user's public key
        const userContact = await uData.contact.getDevices();
        if (groupContract.publicKeys.indexOf(userContact[0].pubKey.toHex()) > -1) {
            publicKeyList.push(new PublicKeyListItem(uData.contact.alias, userContact[0].pubKey.toHex()));
        }
        groupContract.publicKeys.forEach(async (pubKey) => {
            const alias = await getAliasFromPublicKey(pubKey);
            if (alias) {
                publicKeyList.push(new PublicKeyListItem(alias, pubKey));
            }
        });

        // set predecessorList
        if (page.navigationContext.isPredecessor) {
            dataForm.set("predecessor", groupContract.id);
            predecessorList.push(new PredecessorListItem(groupContract.id));
        } else {
            dataForm.set("predecessor", groupContract.predecessor ? groupContract.predecessor.join(",") : "");
            if (groupContract.predecessor.length !== 0) {
                predecessorList.push(new PredecessorListItem(groupContract.predecessor[0]));
            }
        }
    } else {
        dataForm.set("publicKeys", uData.keyIdentity._public.toHex() + ",e7c717a6f052fc4f6e665f7e3e38d153643313eb321ea042f1340daaf6d270e5,d2b034bb987fb01a35d25d3c89f674ba01b512b1a2f4f3a673f78194ec798edc");
        dataForm.set("suite", "edwards25519");
        dataForm.set("purpose", "Testing");
        dataForm.set("voteThreshold", ">1/2");
        dataForm.set("predecessor", "");
        dataForm.set("description", uData.contact.alias);
        publicKeyList.push(new PublicKeyListItem(uData.contact.alias, (await uData.contact.getDevices()).map((d) => d.pubKey.toHex())[0]));
    }
}

// TODO is there a better way?
async function getAliasFromPublicKey(publicKey: string): Promise<string> {
    try {
        for (const contact of uData.contacts) {
            const devices = await contact.getDevices();
            for (const device of devices) {
                if (publicKey === device.pubKey.toHex()) {
                    return contact.alias;
                }
            }
        }
    } catch (e) {
        msgFailed(e.toString(), "Error");
    }
}

class PublicKeyListItem {
    alias: string;
    publicKey: string;

    constructor(alias: string, publicKey: string) {
        this.alias = alias;
        this.publicKey = publicKey;
    }
}

class PredecessorListItem {
    id: string;

    constructor(id: string) {
        this.id = id;
    }
}

import { Group } from "@dedis/kyber";
import { schnorr } from "@dedis/kyber/sign";
import { Public } from "../dynacred/KeyPair";
import { ENCODING, GroupContract } from "./groupContract";

export default class GroupContractCollection {

    private collection: Map<string, GroupContract>; // key: contractID, value: GroupDefinition
    private purpose: string;

    constructor(purpose: string) {
        this.collection = new Map();
        this.purpose = purpose;
    }

    append(groupContract: GroupContract) {
        // only proceed if the the groupDefinition is sound
        if (!groupContract.verify()) {
            throw new Error("not verified");
        }

        // check if the id is not already there
        const existing: GroupContract[] = [];
        this.collection.forEach((gd: GroupContract) => {
            if (gd.id === groupContract.id) {
                existing.push(gd);
            }
        });

        if (existing.length) {
            groupContract.mergeSignoffs(existing[0]);
            this.collection.set(groupContract.id, groupContract);
        } else {
            this.collection.set(groupContract.id, groupContract);
        }
    }

    has(groupContract: GroupContract): boolean {
        return this.collection.has(groupContract.id);
    }

    get(id: string): GroupContract {
        return this.collection.get(id);
    }

    getCurrentGroupContract(publicKey: Public): GroupContract {
        const eligibleContracts = Array.from(this.collection.values()).filter((c) => c.successor.length === 0);

        // check the presence of the publicKey and a corresponding signature
        for (const contract of eligibleContracts) {
            if (contract.publicKeys.indexOf(publicKey.toHex()) > -1) {
                if (contract.signoffs.length) {
                    const message: Buffer = Buffer.from(contract.id, ENCODING);
                    const suite: Group = contract.suite;
                    for (const sig of contract.signoffs) {
                        if (schnorr.verify(suite, publicKey.point, message, Buffer.from(sig, ENCODING))) {
                            return contract;
                        }
                    }
                }
            }
        }
        return undefined;
    }

    // returns [gd] if there is no child to gd
    // returns [[gd,gd2], [gd,gd3]] if there is two children to gd
    getWorldView(groupContract: GroupContract) {
        const children = this.getChildren(groupContract);
        if (!children.length) {
            return [groupContract];
        } else {
            return children.map((c: GroupContract) => {
                return [].concat(...[groupContract].concat(this.getWorldView(c)));
            });
        }
    }

    getParent(groupContract: GroupContract): GroupContract[] {
        if (!groupContract.predecessor.length) {
            return [];
        }

        return groupContract.predecessor.map((id: string) => this.collection.get(id));
    }

    getChildren(groupContract: GroupContract): GroupContract[] {
        if (!groupContract.successor.length) {
            return [];
        }

        return groupContract.successor.map((id: string) => this.collection.get(id));
    }

    // delegation of trust
    isAccepted(groupContract: GroupContract): boolean {
        // if groupDefinition is not included into the collection, append it
        if (!this.has(groupContract)) {
            this.append(groupContract);
        }

        if (groupContract.predecessor.length) {
            const parent = this.getParent(groupContract);
            console.log(parent);
            const verifiedParent = parent.map((p: GroupContract) => {
                if (!this.verifySignoffs(groupContract, p)) {
                    console.log("ici1");
                    return false;
                }

                if (!this.meetVoteThreshold(p.voteThreshold, groupContract.signoffs.length/p.publicKeys.length)) {
                    console.log("ici2");
                    return false;
                }

                return true;
            });

            if (!verifiedParent.reduce((bool1, bool2) => bool1 && bool2)) {
                console.log("ici3");
                return false;
            }

            return true;
        } else {
            // tslint:disable-next-line: max-line-length
            return this.meetVoteThreshold(groupContract.voteThreshold, groupContract.signoffs.length/groupContract.publicKeys.length);
        }
    }

    private verifySignoffs(groupContract: GroupContract, parent: GroupContract): boolean {
        const publicKeys = [...parent.publicKeys];
        console.log(groupContract.signoffs);
        console.log(publicKeys);
        // verify that every signature correspond to one and only one parent public key
        if (groupContract.signoffs.length) {
            const message: Buffer = Buffer.from(groupContract.id, ENCODING);
            const suite: Group = groupContract.suite;
            const verifiedSig: boolean[] = groupContract.signoffs.map((sig: string) => {
                for (const publicKey of publicKeys) {
                    if (schnorr.verify(suite, Public.fromHex(publicKey).point, message, Buffer.from(sig, ENCODING))) {
                        publicKeys.splice(publicKeys.indexOf(publicKey), 1);
                        return true;
                    }
                }
                return false;
            });
            if (!verifiedSig.reduce((bool1, bool2) => bool1 && bool2)) {
                return false;
            }
        }

        return true;
    }

    private meetVoteThreshold(voteThreshold: string, ratio: number): boolean {
        // Test if voteThreshold is well-formed
        const regex = new RegExp("^(>|>=)\\d+/\\d+$");
        if (!regex.test(voteThreshold)) {
            throw new TypeError("The voteThreshold field is not well-formed");
        }

        let idx: number;
        let smallerOrEqual: boolean;
        if (voteThreshold.indexOf("=")) {
            idx = voteThreshold.indexOf("=");
            smallerOrEqual = true;
        } else {
            idx = voteThreshold.indexOf(">");
            smallerOrEqual = false;
        }

        const fractionNumbers: number[] = voteThreshold.slice(idx + 1).split("/").map((f) => +f);
        const numericalVoteThreshold = fractionNumbers[0] / fractionNumbers[1];
        if (numericalVoteThreshold > 1.0) {
            throw new TypeError("The voteThreshold ratio needs to be between 0.0 and 1.0");
        }

        if (smallerOrEqual) {
            return ratio >= numericalVoteThreshold;
        } else {
            return ratio > numericalVoteThreshold;
        }
    }
}

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

    // FIXME review the algorithm
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
    // getCurrentGroupContract(publicKey: Public): GroupContract {
    //     const sortedGroupContracts = Array.from(this.collection.values()).sort((gd1, gd2) => {
    //         if (gd1.creationTime < gd2.creationTime) {
    //             return 1;
    //         } else if (gd1.creationTime === gd2.creationTime) {
    //             return 0;
    //         } else {
    //             return -1;
    //         }
    //     });

    //     for (const gd of sortedGroupContracts) {
    //         if (gd.verify() && this.isValid(gd)) {
    //             if (gd.signoffs.length) {
    //                 const message: Buffer = Buffer.from(gd.id, ENCODING);
    //                 for (const sig of gd.signoffs) {
    //                     // tslint:disable-next-line: max-line-length
    //                     if (schnorr.verify(gd.groupDefinition.suite, publicKey.point, message, Buffer.from(sig, ENCODING))) {
    //                         return gd;
    //                     }
    //                 }
    //             }
    //         }
    //     }

    //     return undefined;
    // }

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

    getChildren(groupContract: GroupContract): GroupContract[] {
        return groupContract.successor.map((id: string) => this.collection.get(id));
    }

    // delegation of trust
    isAccepted(groupContract: GroupContract): boolean {
        // if groupDefinition is not included into the collection, append it
        if (!this.has(groupContract)) {
            this.append(groupContract);
        }

        if (groupContract.predecessor.length) {
            if (groupContract.predecessor.length === 1) {
                const parent: GroupContract = this.collection.get(groupContract.predecessor[0]);
                // tslint:disable-next-line: max-line-length
                return this.meetVoteThreshold(parent.voteThreshold, groupContract.signoffs.length / parent.publicKeys.length);
            } else {
                // const parent: GroupDefinition = this.collection.get(group)

            }
        } else {
            // tslint:disable-next-line: max-line-length
            return this.meetVoteThreshold(groupContract.voteThreshold, groupContract.signoffs.length / groupContract.publicKeys.length);
        }
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

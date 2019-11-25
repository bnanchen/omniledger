import { Group } from "@dedis/kyber";
import { schnorr } from "@dedis/kyber/sign";
import { Public, Private } from "../dynacred/KeyPair";
import { ENCODING, GroupContract } from "./groupContract";
import { GroupDefinition } from "./groupDefinition";

export default class GroupContractCollection {

    private collection: Map<string, GroupContract>; // key: contractID, value: GroupDefinition
    private purpose: string;

    constructor(purpose: string) {
        this.collection = new Map();
        this.purpose = purpose;
    }

    proposeGroupContract(parent: GroupContract, groupDefinition: GroupDefinition): GroupContract {
        let newGroupContract: GroupContract;
        if (parent) {
            newGroupContract = parent.proposeGroupContract(groupDefinition);
        } else {
            newGroupContract = new GroupContract(groupDefinition);
        }
        this.append(newGroupContract);

        return newGroupContract;
    }

    sign(groupContract: GroupContract, privateKey: Private) {
        // create signoff
        const signoff: string = groupContract.groupDefinition.sign(privateKey);
        // append signoff to groupContract
        const parents: GroupContract[] = this.getParent(groupContract);
        let isAppended = false;
        for (let i = 0; i < parents.length && !isAppended; i++) {
            isAppended = groupContract.appendSignoff(signoff, parents[i]);
        }
    }

    append(groupContract: GroupContract) {
        // only proceed if the the groupContract is sound
        const parents = this.getParent(groupContract);
        if (parents.length) {
            if (!this.getParent(groupContract).map((p) => groupContract.verify(p)).reduce((b1, b2) => b1 && b2)) {
                throw new TypeError("Not verified");
            }
        } else {
            if (!groupContract.verify(undefined)) {
                throw new TypeError("Not verified");
            }
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
            const verifiedParent = parent.map((p: GroupContract) => {
                if (!groupContract.verify(p)) {
                    return false;
                }

                return this.meetVoteThreshold(p.voteThreshold, groupContract.signoffs.length / p.publicKeys.length);
            });

            return verifiedParent.reduce((bool1, bool2) => bool1 && bool2);
        } else {
            // tslint:disable-next-line: max-line-length
            return this.meetVoteThreshold(groupContract.voteThreshold, groupContract.signoffs.length/groupContract.publicKeys.length);
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

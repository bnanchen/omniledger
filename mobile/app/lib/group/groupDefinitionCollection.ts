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

    createGroupContract(parent: GroupContract, groupDefinition: GroupDefinition): GroupContract {
        let newGroupContract: GroupContract;
        if (parent) {
            newGroupContract = parent.proposeGroupContract(groupDefinition);
        } else {
            newGroupContract = new GroupContract(groupDefinition);
        }
        this.append(newGroupContract);

        return newGroupContract;
    }

    sign(groupContract: GroupContract, privateKey: Private): boolean {
        // create signoff
        const signoff: string = groupContract.groupDefinition.sign(privateKey);
        // append signoff to groupContract
        const parents: GroupContract[] = this.getParent(groupContract);
        let isAppended = false;
        for (let i = 0; i < parents.length && !isAppended; i++) {
            isAppended = groupContract.appendSignoff(signoff, parents[i]);
        }

        return isAppended;
    }

    append(groupContract: GroupContract) {
        // only proceed if the the groupContract is sound
        const parents = this.getParent(groupContract);
        if (parents.length) {
            if (!groupContract.verify(...this.getParent(groupContract))) {
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

    getCurrentGroupContract(publicKey: string): GroupContract {
        const eligibleContracts = Array.from(this.collection.values()).filter((c) => c.successor.length === 0);

        // check the presence of the publicKey and a corresponding signature
        for (const contract of eligibleContracts) {
            if (contract.publicKeys.indexOf(publicKey) > -1) {
                if (contract.signoffs.length) {
                    const message: Buffer = Buffer.from(contract.id, ENCODING);
                    const suite: Group = contract.suite;
                    for (const sig of contract.signoffs) {
                        // TODO try to move all the crypto to groupDefinition
                        if (contract.groupDefinition.verifySignoffWithPublicKey(sig, publicKey, message)) {
                            // if (schnorr.verify(suite, publicKey.point, message, Buffer.from(sig, ENCODING))) {
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
        if (!groupContract.predecessor.length) {
            throw new TypeError("The groupContract has to have at least one predecessor");
        }

        // if groupDefinition is not included into the collection, append it
        if (!this.has(groupContract)) {
            this.append(groupContract);
        }

        const parent = this.getParent(groupContract);
        if (!groupContract.verify(...parent)) {
            return false;
        }

        const verifiedParent = parent.map((p: GroupContract) => {
            // we count the number of signoffs for a specific parent because
            // when there is multiple parent each parent vote threshold need to be reached
            // by the organizers in the parent (not all the organizers of the current group)
            let numbSignoffsByParent = 0;
            for (const s of groupContract.signoffs) {
                if (groupContract.groupDefinition.verifySignoff(s, p.groupDefinition)) {
                    numbSignoffsByParent++;
                }
            }

            return this.meetVoteThreshold(p.voteThreshold, numbSignoffsByParent / p.publicKeys.length);
        });

        return verifiedParent.reduce((bool1, bool2) => bool1 && bool2);
    }

    private meetVoteThreshold(voteThreshold: string, ratio: number): boolean {
        // Test if voteThreshold is well-formed
        voteThreshold = voteThreshold.replace(/\s/g, ""); // remove whitespaces
        const regex = new RegExp("^(>|>=)\\d+/\\d+$");
        if (!regex.test(voteThreshold)) {
            throw new TypeError("The voteThreshold field is not well-formed");
        }

        let idx: number;
        let biggerOrEqual: boolean;
        if (voteThreshold.indexOf("=") > -1) {
            idx = voteThreshold.indexOf("=");
            biggerOrEqual = true;
        } else {
            idx = voteThreshold.indexOf(">");
            biggerOrEqual = false;
        }

        const fractionNumbers: number[] = voteThreshold.slice(idx + 1).split("/").map((f) => +f);
        const numericalVoteThreshold = fractionNumbers[0] / fractionNumbers[1];
        if (numericalVoteThreshold > 1.0) {
            throw new TypeError("The voteThreshold ratio needs to be between 0.0 and 1.0");
        } else if (numericalVoteThreshold === 1.0 && !biggerOrEqual) {
            // translate >1 to >=1 (because >1 makes no sense)
            biggerOrEqual = true;
        }

        if (biggerOrEqual) {
            return ratio >= numericalVoteThreshold;
        } else {
            return ratio > numericalVoteThreshold;
        }
    }
}

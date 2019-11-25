import { schnorr } from "@dedis/kyber/sign";
import { Private } from "../dynacred";
import { GroupDefinition, IGroupDefinition } from "./groupDefinition";
import { Group } from "@dedis/kyber";

export const ENCODING: string = "hex";

export interface IGroupContract {
    id: string;
    groupDefinition: IGroupDefinition;
    signoffs: string[];
    successor: string[];
}

export class GroupContract {
    // TODO GroupContract est un container qui gère tous les éléments
    static createFromJSON(json: IGroupContract): GroupContract {

        // TODO test the id

        const groupDefinition = GroupDefinition.createFromJSON(json.groupDefinition);
        return new GroupContract(groupDefinition, json.signoffs);
    }

    private _id: string;
    private _groupDefinition: GroupDefinition;
    private _signoffs: string[]; // class signoff avec static createSignoff
    private _successor: string[];

    constructor(groupDefinition: GroupDefinition, signoffs = []) {
        this._groupDefinition = groupDefinition;
        this._id =  groupDefinition.getId();
        this._signoffs = signoffs;
        this._successor = [];
    }

    proposeGroupContract(newGroupDefinition: GroupDefinition): GroupContract {
        if (!newGroupDefinition.predecessor.includes(this._id)) {
            newGroupDefinition.predecessor.push(this._id);
        }

        const newGroupContract = new GroupContract(newGroupDefinition);
        this._successor.push(newGroupContract._id);
        return newGroupContract;
    }

    appendSignoff(signoff: string, p: GroupContract): boolean {
        // check the signoff
        if (!this._groupDefinition.verifySignoff(signoff, p.groupDefinition)) {
            return false;
        }

        this._signoffs.push(signoff);
        return true;
    }

    verify(parent: GroupContract): boolean {
        return this._groupDefinition.verify(this._signoffs, parent ? parent.groupDefinition : undefined);
    }

    mergeSignoffs(groupContract: GroupContract) {
        if (this._id === groupContract._id) {
            const newSignoffs: string[] = groupContract._signoffs.filter((sig: string, idx: number) => {
                return this._signoffs.indexOf(sig) !== idx;
            });
            newSignoffs.forEach((sig: string) => this._signoffs.push(sig));
        }
    }

    toJSON(): IGroupContract {
        return {
            id: this._id,
            groupDefinition: this._groupDefinition.toJSON(),
            signoffs: this._signoffs,
            successor: this._successor,
        };
    }

    get id(): string {
        return this._id;
    }

    get groupDefinition(): GroupDefinition {
        return this._groupDefinition;
    }

    get signoffs(): string[] {
        return this._signoffs;
    }

    get successor(): string[] {
        return this._successor;
    }

    get publicKeys(): string[] {
        return this._groupDefinition.publicKeys;
    }

    get voteThreshold(): string {
        return this._groupDefinition.voteThreshold;
    }

    get predecessor(): string[] {
        return this._groupDefinition.predecessor;
    }

    get suite(): Group {
        return this._groupDefinition.suiteGroup;
    }
}

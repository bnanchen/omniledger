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

    static createFromJSON(json: IGroupContract): GroupContract {

        // TODO test the id

        const groupDefinition = GroupDefinition.createFromJSON(json.groupDefinition);
        return new GroupContract(groupDefinition, json.signoffs);
    }

    private _id: string;
    private _groupDefinition: GroupDefinition;
    private _signoffs: string[];
    private _successor: string[];

    constructor(groupDefinition: GroupDefinition, signoffs = []) {
        this._groupDefinition = groupDefinition;
        // tslint:disable-next-line: max-line-length
        this._id = schnorr.hashSchnorr(this._groupDefinition.suiteGroup, Buffer.from(JSON.stringify(this._groupDefinition.toJSON()))).marshalBinary().toString(ENCODING);
        this._signoffs = signoffs;
        this._successor = [];
    }

    sign(privateKey: Private) {
        // create signature
        const message: Buffer = Buffer.from(this._id, ENCODING);
        // tslint:disable-next-line: max-line-length
        const signature: string = schnorr.sign(this._groupDefinition.suiteGroup, privateKey.scalar, message).toString(ENCODING);

        // append signature
        this._signoffs.push(signature);
    }

    verify(): boolean {
        return this._groupDefinition.verify(this._id, this._signoffs);
    }

    proposeNewGroupContract(newGroupDefinition: GroupDefinition): GroupContract {
        if (!newGroupDefinition.predecessor.includes(this._id)) {
            newGroupDefinition.predecessor.push(this._id);
        }

        const newGroupContract = new GroupContract(newGroupDefinition);
        this._successor.push(newGroupContract._id);
        return newGroupContract;
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

    get groupDefinition(): IGroupDefinition {
        return this._groupDefinition.allVariables;
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

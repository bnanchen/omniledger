import { schnorr } from "@dedis/kyber/sign";
import { Private } from "../dynacred";
import { Public } from "../dynacred/KeyPair";
import { GroupDefinition, IGroupDefinition } from "./groupDefinition";

export const ENCODING: string = "hex";

export class GroupContract {

    static createFromJSON(json: string): GroupContract {
        const jsonText = JSON.parse(json);

        // TODO test the id

        const groupDefinition = GroupDefinition.createFromJSON(jsonText.groupDefinition);
        return new GroupContract(groupDefinition, jsonText.signoffs);
    }

    private _id: string;
    private _groupDefinition: GroupDefinition;
    private _signoffs: string[];
    private _successor: string[];

    constructor(groupDefinition: GroupDefinition, signoffs = []) {
        this._groupDefinition = groupDefinition;
        // tslint:disable-next-line: max-line-length
        this._id = schnorr.hashSchnorr(this._groupDefinition.suite, Buffer.from(this._groupDefinition.toJSON())).marshalBinary().toString(ENCODING);
        this._signoffs = signoffs;
        this._successor = [];
    }

    sign(privateKey: Private) {
        // create signature
        const message: Buffer = Buffer.from(this._id, ENCODING);
        // tslint:disable-next-line: max-line-length
        const signature: string = schnorr.sign(this._groupDefinition.suite, privateKey.scalar, message).toString(ENCODING);

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

    toJSON(): string {
        const jsonObject = {
            id: this._id,
            groupDefinition: this.groupDefinition.toJSON(),
            signoffs: this._signoffs,
            successor: this._successor,
        };

        return JSON.stringify(jsonObject);
    }

    get id(): string {
        return this._id;
    }

    get groupDefinition(): GroupDefinition {
        return this._groupDefinition;
    }

    get groupDefinitionVariables(): IGroupDefinition {
        return this.groupDefinition.allVariables;
    }

    get signoffs(): string[] {
        return this._signoffs;
    }

    get successor(): string[] {
        return this._successor;
    }

    get publicKeys(): Public[] {
        return this.groupDefinition.publicKeys;
    }

    get voteThreshold(): number {
        return this.groupDefinition.voteThreshold;
    }

    get predecessor(): string[] {
        return this.groupDefinition.predecessor;
    }
}

// tslint:disable-next-line
require("nativescript-nodeify");

import { Data, Private } from "@c4dt/dynacred";
import { ByzCoinRPC } from "@dedis/cothority/byzcoin";
import { Signer, SignerEd25519 } from "@dedis/cothority/darc";
import Darc from "@dedis/cothority/darc/darc";
import Log from "@dedis/cothority/log";
import { Roster } from "@dedis/cothority/network";
import Long from "long";
import { StorageFile } from "~/lib/storage-file";

/**
 * This class allows for setting up a new ByzCoin system, complete with a spawnerInstance ready to create new
 * instances. Currently the `admin`, `darc`, and `createTestUser` is not used, but as this class was used
 * previously in the tests for setting up the system and making sure it all works nice, these fields and
 * methods are kept for the moment (August 2019).
 */
export class TestData extends Data {

    static async loadTD(bc: ByzCoinRPC, name: string = "storage/data.json"): Promise<TestData> {
        Log.lvl1("Loading data from", name);
        const values = await StorageFile.getObject(name);
        if (!values || values === {}) {
            throw new Error("No data available");
        }
        const d = new TestData(bc, values);
        if (d.contact && d.contact.isRegisteredByzCoin(bc)) {
            await d.connectByzcoin();
        }
        return d;
    }

    static async init(alias: string = "admin", r: Roster): Promise<TestData> {
        try {
            const admin = SignerEd25519.random();
            const d = ByzCoinRPC.makeGenesisDarc([admin], r, "genesis darc");
            ["spawn:spawner", "spawn:coin", "spawn:credential", "spawn:longTermSecret", "spawn:calypsoWrite",
                "spawn:calypsoRead",
                "invoke:coin.mint", "invoke:coin.transfer", "invoke:coin.fetch"].forEach((rule) => {
                d.rules.appendToRule(rule, admin, "|");
            });
            const bc = await ByzCoinRPC.newByzCoinRPC(r, d, Long.fromNumber(2.5e9));

            const fu = await Data.createFirstUser(bc, bc.getDarc().getBaseID(), admin.secret, alias);
            fu.storage = StorageFile;
            await fu.save();
            const td = await TestData.loadTD(bc);
            td.admin = admin;
            td.darc = d;
            return td;
        } catch (e) {
            return Log.rcatch(e, "couldn't initialize ByzCoin");
        }
    }

    admin: Signer;
    darc: Darc;

    constructor(bc: ByzCoinRPC, obj: {}) {
        super(bc, obj);
        this.storage = StorageFile;
    }

    async createTestUser(alias: string, ephemeral?: Private): Promise<Data> {
        const d = await super.createUser(alias, ephemeral);
        d.dataFileName = "user_" + alias;
        await this.coinInstance.transfer(Long.fromNumber(1e6), d.coinInstance.id, [this.keyIdentitySigner]);
        while (d.coinInstance.value.lessThan(1e6)) {
            await d.coinInstance.update();
        }
        await d.save();
        return d;
    }
}

import { Observable } from "tns-core-modules/data/observable";
import { ObservableArray } from "tns-core-modules/data/observable-array";
import Log from "~/lib/cothority/log";
import { Roster, ServerIdentity } from "~/lib/cothority/network";
import { WebSocketConnection } from "~/lib/cothority/network/connection";
import { StatusRPC } from "~/lib/cothority/status";
import { StatusRequest, StatusResponse } from "~/lib/cothority/status/proto";
import { Data } from "~/lib/dynacred";
import { nodeList } from "~/pages/settings/settings-page";
import { appVersion, testingMode, uData } from "~/lib/user-data";

export class AdminViewModel extends Observable {
    nodes: ObservableArray<Node> = new ObservableArray();
    testing: boolean = testingMode;
    version = appVersion;

    constructor(d: Data) {
        super();
        this.admin = new Admin(d.continuousScan);
        this.updateNodes();
    }

    async updateNodes() {
        this.nodes.splice(0);
        if (nodeList) {
            this.nodes.push(...nodeList.map((ws) => new Node(ws, this)));
            await Promise.all(this.nodes.map((n) => n.getStatus()));
        }
    }

    set admin(value: Admin) {
        this.set("_admin", value);
    }

    get admin(): Admin {
        return this.get("_admin");
    }
}

export class Admin {
    constructor(public continuousScan: boolean) {
    }
}

export class Node {
    address: string;
    status: string;

    constructor(private ws: WebSocketConnection, private am: AdminViewModel) {
        this.address = ws.getURL();
        this.status = "unknown";
    }

    async getStatus() {
        try {
            const stat: StatusResponse = await this.ws.send(new StatusRequest(), StatusResponse);
            Log.lvl2("Got status from", this.address);
            this.status = "up " + stat.getStatus("Generic").field.Uptime;
        } catch (e) {
            this.status = "error";
        }
        this.am.nodes.splice(0, 0);
    }
}

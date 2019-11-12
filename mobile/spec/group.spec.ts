import { curve } from "@dedis/kyber";
import Log from "../app/lib/cothority/log";
import { KeyPair } from "../app/lib/dynacred/KeyPair";
import { GroupDefinition } from "../app/lib/groupDefinition";
import groupDefinitionList from "../app/lib/groupDefinitionCollection";

const ed25519 = curve.newCurve("edwards25519");

describe("Group Management", () => {
    it("Test base behaviour", () => {
        const user1 = new KeyPair();
        const user2 = new KeyPair();

        // creation of the first group definition
        const originalVar = {
            orgPubKeys: [user1._public, user2._public],
            suite: ed25519,
            voteThreshold: 50.0,
            purpose: "Test",
        };
        const originalGD = new GroupDefinition(originalVar);

        // user1 exchanges the first group definition
        originalGD.addSignature(user1._private);

        // user2 receives the group definition by JSON
        const jsonGD: string = originalGD.toJSON();
        const user2OriginalGD = GroupDefinition.createFromJSON(jsonGD);

        // user2 accepts the group definition
        user2OriginalGD.addSignature(user2._private);

        expect(user2OriginalGD.validate()).toBeTruthy();
        expect(user2OriginalGD.verify()).toBeTruthy();

        Log.print("Test basic behaviour passed!");
    });
    it("Test GroupDefinitionList", () => {
        const gdl = groupDefinitionList.getInstance();

        Log.print("Test GroupDefinitionList passed!");
    });
});

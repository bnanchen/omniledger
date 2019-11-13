import { curve } from "@dedis/kyber";
import Log from "../app/lib/cothority/log";
import { KeyPair } from "../app/lib/dynacred/KeyPair";
import { GroupDefinition } from "../app/lib/groupDefinition";
import GroupDefinitionCollection from "../app/lib/groupDefinitionCollection";

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

        expect(user2OriginalGD.verify()).toBeTruthy();
        Log.print("Test basic behaviour passed!");
    });
    it("Test GroupDefinitionList", () => {
        const user1 = new KeyPair();
        const user2 = new KeyPair();

        // creation of the GroupDefinitionCollection
        const purpose: string = "Test";
        const gdCollection = new GroupDefinitionCollection(purpose);

        // creation of the first group definition
        const orginialVar = {
            orgPubKeys: [user1._public, user2._public],
            suite: ed25519,
            voteThreshold: 50.0,
            purpose,
        };
        let gd1 = new GroupDefinition(orginialVar);

        // append to the group definition collection
        gdCollection.append(gd1);

        // user1 exchanges the first group definition
        gd1.addSignature(user1._private);

        // user2 receives the group definition by JSON
        let jsonGD: string = gd1.toJSON();
        const user2gd1 = GroupDefinition.createFromJSON(jsonGD);

        // user2 accepts the group definition
        user2gd1.addSignature(user2._private);

        // user1 receives back the group definition by JSON
        jsonGD = user2gd1.toJSON();
        gd1 = GroupDefinition.createFromJSON(jsonGD);

        // update group definition Collection
        gdCollection.append(gd1);

        // first test
        expect(gdCollection.has(gd1)).toBeTruthy();
        expect(gdCollection.get(gd1.id)).toEqual(gd1);
        Log.print("First part of test GroupDefinitionList passed!");

        // new user
        const user3 = new KeyPair();

        // propose user3 as a new member in a new group definition
        const newVar = gd1.allVariables;
        newVar.orgPubKeys.push(user3._public);
        let gd2: GroupDefinition = gd1.proposeNewGroupDefinition(newVar);

        // append to the group definition collection
        gdCollection.append(gd2);

        // user1 exchanges the first group definition
        gd2.addSignature(user1._private);

        // user2 receives the group definition by JSON
        jsonGD = gd2.toJSON();
        const user2gd2 = GroupDefinition.createFromJSON(jsonGD);

        // user2 accepts the group definition
        user2gd2.addSignature(user2._private);

        // user3 receives the group definition by JSON
        jsonGD = user2gd2.toJSON();
        const user3gd2 = GroupDefinition.createFromJSON(jsonGD);

        // user3 signs the group definition
        user3gd2.addSignature(user3._private);

        // user1 gets back the group definition
        jsonGD = user3gd2.toJSON();
        gd2 = GroupDefinition.createFromJSON(jsonGD);
        gdCollection.append(gd2);

        // Second tests
        expect(gdCollection.get(gd2.id)).toEqual(gd2);
        expect(gdCollection.getChildren(gd1)).toEqual([gd2]);
        expect(gdCollection.isValid(gd1)).toBeTruthy();
        expect(gdCollection.isValid(gd2)).toBeTruthy();
        Log.print("Second part of test GroupDescriptionCollection is passed!");
    });
    it("Test multiple signature by same user", () => {
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
        originalGD.addSignature(user1._private);

        // user2 receives the group definition by JSON
        const jsonGD: string = originalGD.toJSON();
        const user2OriginalGD = GroupDefinition.createFromJSON(jsonGD);

        // user2 accepts the group definition
        user2OriginalGD.addSignature(user2._private);

        expect(user2OriginalGD.verify()).toBeFalsy();
        Log.print("Test multiple signature by same user passed!");
    });
});

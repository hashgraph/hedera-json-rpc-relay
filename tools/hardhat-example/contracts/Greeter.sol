//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract GreeterFactory {

    uint create1Count;
    uint create2Count;

    event CreatedGreeter1(address greeter);
    event CreatedGreeter2(address greeter);

    function create1Greeter(string memory _greeting) public {

        create1Count++;

        address greeter1 = address(new Greeter(_greeting));

        emit CreatedGreeter1(greeter1);
    }

    function create2Greeter(string memory _greeting) public {

        uint _create2Count = ++create2Count;

        bytes memory _deployData = abi.encode(_create2Count);
        bytes32 salt = keccak256(_deployData);

        address greeter2 = address(new Greeter{salt: salt}(_greeting));

        emit CreatedGreeter2(greeter2);
    }
}

contract Greeter {
    string private greeting;

    event GreetingSet(address greeter, string greeting);

    constructor(string memory _greeting) {
        greeting = _greeting;

        emit GreetingSet(address(this), _greeting);
    }

    function greet() public view returns (string memory) {
        return greeting;
    }

    function setGreeting(string memory _greeting) public {
        greeting = _greeting;

        emit GreetingSet(address(this), _greeting);
    }
}

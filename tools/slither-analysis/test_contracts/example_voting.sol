// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleVoting {
    struct Voter {
        bool voted;
        uint vote;
    }

    struct Candidate {
        string name;
        uint voteCount;
    }

    address public owner;
    mapping(address => Voter) public voters;
    Candidate[] public candidates;
    bool public votingEnded;

    constructor(string[] memory candidateNames) {
        owner = msg.sender;
        for (uint i = 0; i < candidateNames.length; i++) {
            candidates.push(Candidate({
                name: candidateNames[i],
                voteCount: 0
            }));
        }
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this.");
        _;
    }

    function registerVoter(address voter) public onlyOwner {
        require(!voters[voter].voted, "The voter already registered.");
        voters[voter].voted = false;
    }

    function vote(uint candidateIndex) public {
        require(!votingEnded, "Voting is closed.");
        require(!voters[msg.sender].voted, "Already voted.");
        require(candidateIndex < candidates.length, "Invalid candidate index.");

        voters[msg.sender].voted = true;
        voters[msg.sender].vote = candidateIndex;
        candidates[candidateIndex].voteCount += 1;
    }

    function endVoting() public onlyOwner {
        require(!votingEnded, "Voting already ended.");
        votingEnded = true;
    }

    function getWinner() public view returns (string memory winnerName) {
        require(votingEnded, "Voting has not ended yet.");
        uint winningVoteCount = 0;
        for (uint i = 0; i < candidates.length; i++) {
            if (candidates[i].voteCount > winningVoteCount) {
                winningVoteCount = candidates[i].voteCount;
                winnerName = candidates[i].name;
            }
        }
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleCrowdfunding {
    struct Campaign {
        address payable owner;
        string description;
        uint goal;
        uint fundsRaised;
        bool isOpen;
    }

    uint public numCampaigns;
    mapping(uint => Campaign) public campaigns;

    event CampaignCreated(uint campaignId, string description, uint goal);
    event ContributionReceived(uint campaignId, address contributor, uint amount);
    event CampaignClosed(uint campaignId);

    constructor() {
        numCampaigns = 0;
    }

    function createCampaign(string memory description, uint goal) public {
        require(goal > 0, "Goal must be greater than 0");
        uint campaignId = numCampaigns++;
        campaigns[campaignId] = Campaign({
            owner: payable(msg.sender),
            description: description,
            goal: goal,
            fundsRaised: 0,
            isOpen: true
        });
        emit CampaignCreated(campaignId, description, goal);
    }

    function contribute(uint campaignId) public payable {
        Campaign storage campaign = campaigns[campaignId];
        require(campaign.isOpen, "This campaign is no longer open.");
        require(msg.value > 0, "Contribution must be greater than 0");

        campaign.fundsRaised += msg.value;
        emit ContributionReceived(campaignId, msg.sender, msg.value);

        if (campaign.fundsRaised >= campaign.goal) {
            campaign.isOpen = false;
            campaign.owner.transfer(campaign.fundsRaised);
            emit CampaignClosed(campaignId);
        }
    }

    function getCampaignDetails(uint campaignId) public view returns (
        address owner,
        string memory description,
        uint goal,
        uint fundsRaised,
        bool isOpen
    ) {
        Campaign memory campaign = campaigns[campaignId];
        return (
            campaign.owner,
            campaign.description,
            campaign.goal,
            campaign.fundsRaised,
            campaign.isOpen
        );
    }
}

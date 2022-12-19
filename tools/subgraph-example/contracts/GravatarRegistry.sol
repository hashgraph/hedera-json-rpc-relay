// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

contract GravatarRegistry {
  constructor () {
    setMythicalGravatar();
  }

  event NewGravatar(uint id, address owner, string displayName, string imageUrl);
  event UpdatedGravatar(uint id, address owner, string displayName, string imageUrl);

  struct Gravatar {
    address owner;
    string displayName;
    string imageUrl;
  }

  Gravatar[] public gravatars;

  mapping (uint => address) public gravatarToOwner;
  mapping (address => uint) public ownerToGravatar;

  function createGravatar(string calldata _displayName, string calldata _imageUrl) public {
    require(ownerToGravatar[msg.sender] == 0);
    gravatars.push(Gravatar(address(msg.sender), _displayName, _imageUrl));
    uint id = gravatars.length - 1;

    gravatarToOwner[id] = msg.sender;
    ownerToGravatar[msg.sender] = id;

    emit NewGravatar(id, msg.sender, _displayName, _imageUrl);
  }

  function getGravatar(address owner) public view returns (string memory, string memory) {
    uint id = ownerToGravatar[owner];
    return (gravatars[id].displayName, gravatars[id].imageUrl);
  }

  function updateGravatarName(string calldata _displayName) public {
    require(ownerToGravatar[msg.sender] != 0);
    require(msg.sender == gravatars[ownerToGravatar[msg.sender]].owner);

    uint id = ownerToGravatar[msg.sender];

    gravatars[id].displayName = _displayName;
    emit UpdatedGravatar(id, msg.sender, _displayName, gravatars[id].imageUrl);
  }

  function updateGravatarImage(string calldata _imageUrl) public {
    require(ownerToGravatar[msg.sender] != 0);
    require(msg.sender == gravatars[ownerToGravatar[msg.sender]].owner);

    uint id = ownerToGravatar[msg.sender];

    gravatars[id].imageUrl =  _imageUrl;
    emit UpdatedGravatar(id, msg.sender, gravatars[id].displayName, _imageUrl);
  }

  // The gravatar at position 0 of gravatars[] is fake
  // It's a mythical gravatar that doesn't really exist
  // It will be created on contract deployment
  function setMythicalGravatar() private {
    gravatars.push(Gravatar(address(0), " ", " "));
  }
}

// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package greeter

import (
	"errors"
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/event"
)

// Reference imports to suppress errors if they are not otherwise used.
var (
	_ = errors.New
	_ = big.NewInt
	_ = strings.NewReader
	_ = ethereum.NotFound
	_ = bind.Bind
	_ = common.Big1
	_ = types.BloomLookup
	_ = event.NewSubscription
	_ = abi.ConvertType
)

// StoreMetaData contains all meta data concerning the Store contract.
var StoreMetaData = &bind.MetaData{
	ABI: "[{\"inputs\":[{\"internalType\":\"string\",\"name\":\"_greeting\",\"type\":\"string\"}],\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"internalType\":\"string\",\"name\":\"greeting\",\"type\":\"string\"}],\"name\":\"GreetingSet\",\"type\":\"event\"},{\"inputs\":[],\"name\":\"greet\",\"outputs\":[{\"internalType\":\"string\",\"name\":\"\",\"type\":\"string\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"_greeting\",\"type\":\"string\"}],\"name\":\"setGreeting\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"}]",
	Bin: "0x608060405234801561001057600080fd5b506040516105fc3803806105fc83398101604081905261002f9161015f565b8051610042906000906020840190610080565b507fad181ee258ff92d26bf7ed2e6b571ef1cba3afc45f028b863b0f02adaffc2f0681604051610072919061020b565b60405180910390a150610279565b82805461008c9061023e565b90600052602060002090601f0160209004810192826100ae57600085556100f4565b82601f106100c757805160ff19168380011785556100f4565b828001600101855582156100f4579182015b828111156100f45782518255916020019190600101906100d9565b50610100929150610104565b5090565b5b808211156101005760008155600101610105565b634e487b7160e01b600052604160045260246000fd5b60005b8381101561014a578181015183820152602001610132565b83811115610159576000848401525b50505050565b60006020828403121561017157600080fd5b81516001600160401b038082111561018857600080fd5b818401915084601f83011261019c57600080fd5b8151818111156101ae576101ae610119565b604051601f8201601f19908116603f011681019083821181831017156101d6576101d6610119565b816040528281528760208487010111156101ef57600080fd5b61020083602083016020880161012f565b979650505050505050565b602081526000825180602084015261022a81604085016020870161012f565b601f01601f19169190910160400192915050565b600181811c9082168061025257607f821691505b6020821081141561027357634e487b7160e01b600052602260045260246000fd5b50919050565b610374806102886000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c8063a41368621461003b578063cfae321714610050575b600080fd5b61004e6100493660046101fd565b61006e565b005b6100586100bc565b60405161006591906102ae565b60405180910390f35b805161008190600090602084019061014e565b507fad181ee258ff92d26bf7ed2e6b571ef1cba3afc45f028b863b0f02adaffc2f06816040516100b191906102ae565b60405180910390a150565b6060600080546100cb90610303565b80601f01602080910402602001604051908101604052809291908181526020018280546100f790610303565b80156101445780601f1061011957610100808354040283529160200191610144565b820191906000526020600020905b81548152906001019060200180831161012757829003601f168201915b5050505050905090565b82805461015a90610303565b90600052602060002090601f01602090048101928261017c57600085556101c2565b82601f1061019557805160ff19168380011785556101c2565b828001600101855582156101c2579182015b828111156101c25782518255916020019190600101906101a7565b506101ce9291506101d2565b5090565b5b808211156101ce57600081556001016101d3565b634e487b7160e01b600052604160045260246000fd5b60006020828403121561020f57600080fd5b813567ffffffffffffffff8082111561022757600080fd5b818401915084601f83011261023b57600080fd5b81358181111561024d5761024d6101e7565b604051601f8201601f19908116603f01168101908382118183101715610275576102756101e7565b8160405282815287602084870101111561028e57600080fd5b826020860160208301376000928101602001929092525095945050505050565b600060208083528351808285015260005b818110156102db578581018301518582016040015282016102bf565b818111156102ed576000604083870101525b50601f01601f1916929092016040019392505050565b600181811c9082168061031757607f821691505b6020821081141561033857634e487b7160e01b600052602260045260246000fd5b5091905056fea2646970667358221220ef2c6ab51ea25926775e8994ead2c20a5d48f3913813018a19e4bfd379499b6764736f6c63430008090033",
}

// StoreABI is the input ABI used to generate the binding from.
// Deprecated: Use StoreMetaData.ABI instead.
var StoreABI = StoreMetaData.ABI

// StoreBin is the compiled bytecode used for deploying new contracts.
// Deprecated: Use StoreMetaData.Bin instead.
var StoreBin = StoreMetaData.Bin

// DeployStore deploys a new Ethereum contract, binding an instance of Store to it.
func DeployStore(auth *bind.TransactOpts, backend bind.ContractBackend, _greeting string) (common.Address, *types.Transaction, *Store, error) {
	parsed, err := StoreMetaData.GetAbi()
	if err != nil {
		return common.Address{}, nil, nil, err
	}
	if parsed == nil {
		return common.Address{}, nil, nil, errors.New("GetABI returned nil")
	}

	address, tx, contract, err := bind.DeployContract(auth, *parsed, common.FromHex(StoreBin), backend, _greeting)
	if err != nil {
		return common.Address{}, nil, nil, err
	}
	return address, tx, &Store{StoreCaller: StoreCaller{contract: contract}, StoreTransactor: StoreTransactor{contract: contract}, StoreFilterer: StoreFilterer{contract: contract}}, nil
}

// Store is an auto generated Go binding around an Ethereum contract.
type Store struct {
	StoreCaller     // Read-only binding to the contract
	StoreTransactor // Write-only binding to the contract
	StoreFilterer   // Log filterer for contract events
}

// StoreCaller is an auto generated read-only Go binding around an Ethereum contract.
type StoreCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// StoreTransactor is an auto generated write-only Go binding around an Ethereum contract.
type StoreTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// StoreFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type StoreFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// StoreSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type StoreSession struct {
	Contract     *Store            // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// StoreCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type StoreCallerSession struct {
	Contract *StoreCaller  // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts // Call options to use throughout this session
}

// StoreTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type StoreTransactorSession struct {
	Contract     *StoreTransactor  // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// StoreRaw is an auto generated low-level Go binding around an Ethereum contract.
type StoreRaw struct {
	Contract *Store // Generic contract binding to access the raw methods on
}

// StoreCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type StoreCallerRaw struct {
	Contract *StoreCaller // Generic read-only contract binding to access the raw methods on
}

// StoreTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type StoreTransactorRaw struct {
	Contract *StoreTransactor // Generic write-only contract binding to access the raw methods on
}

// NewStore creates a new instance of Store, bound to a specific deployed contract.
func NewStore(address common.Address, backend bind.ContractBackend) (*Store, error) {
	contract, err := bindStore(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &Store{StoreCaller: StoreCaller{contract: contract}, StoreTransactor: StoreTransactor{contract: contract}, StoreFilterer: StoreFilterer{contract: contract}}, nil
}

// NewStoreCaller creates a new read-only instance of Store, bound to a specific deployed contract.
func NewStoreCaller(address common.Address, caller bind.ContractCaller) (*StoreCaller, error) {
	contract, err := bindStore(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &StoreCaller{contract: contract}, nil
}

// NewStoreTransactor creates a new write-only instance of Store, bound to a specific deployed contract.
func NewStoreTransactor(address common.Address, transactor bind.ContractTransactor) (*StoreTransactor, error) {
	contract, err := bindStore(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &StoreTransactor{contract: contract}, nil
}

// NewStoreFilterer creates a new log filterer instance of Store, bound to a specific deployed contract.
func NewStoreFilterer(address common.Address, filterer bind.ContractFilterer) (*StoreFilterer, error) {
	contract, err := bindStore(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &StoreFilterer{contract: contract}, nil
}

// bindStore binds a generic wrapper to an already deployed contract.
func bindStore(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := StoreMetaData.GetAbi()
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, *parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Store *StoreRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Store.Contract.StoreCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Store *StoreRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Store.Contract.StoreTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Store *StoreRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Store.Contract.StoreTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Store *StoreCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Store.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Store *StoreTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Store.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Store *StoreTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Store.Contract.contract.Transact(opts, method, params...)
}

// Greet is a free data retrieval call binding the contract method 0xcfae3217.
//
// Solidity: function greet() view returns(string)
func (_Store *StoreCaller) Greet(opts *bind.CallOpts) (string, error) {
	var out []interface{}
	err := _Store.contract.Call(opts, &out, "greet")

	if err != nil {
		return *new(string), err
	}

	out0 := *abi.ConvertType(out[0], new(string)).(*string)

	return out0, err

}

// Greet is a free data retrieval call binding the contract method 0xcfae3217.
//
// Solidity: function greet() view returns(string)
func (_Store *StoreSession) Greet() (string, error) {
	return _Store.Contract.Greet(&_Store.CallOpts)
}

// Greet is a free data retrieval call binding the contract method 0xcfae3217.
//
// Solidity: function greet() view returns(string)
func (_Store *StoreCallerSession) Greet() (string, error) {
	return _Store.Contract.Greet(&_Store.CallOpts)
}

// SetGreeting is a paid mutator transaction binding the contract method 0xa4136862.
//
// Solidity: function setGreeting(string _greeting) returns()
func (_Store *StoreTransactor) SetGreeting(opts *bind.TransactOpts, _greeting string) (*types.Transaction, error) {
	return _Store.contract.Transact(opts, "setGreeting", _greeting)
}

// SetGreeting is a paid mutator transaction binding the contract method 0xa4136862.
//
// Solidity: function setGreeting(string _greeting) returns()
func (_Store *StoreSession) SetGreeting(_greeting string) (*types.Transaction, error) {
	return _Store.Contract.SetGreeting(&_Store.TransactOpts, _greeting)
}

// SetGreeting is a paid mutator transaction binding the contract method 0xa4136862.
//
// Solidity: function setGreeting(string _greeting) returns()
func (_Store *StoreTransactorSession) SetGreeting(_greeting string) (*types.Transaction, error) {
	return _Store.Contract.SetGreeting(&_Store.TransactOpts, _greeting)
}

// StoreGreetingSetIterator is returned from FilterGreetingSet and is used to iterate over the raw logs and unpacked data for GreetingSet events raised by the Store contract.
type StoreGreetingSetIterator struct {
	Event *StoreGreetingSet // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *StoreGreetingSetIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(StoreGreetingSet)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(StoreGreetingSet)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *StoreGreetingSetIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *StoreGreetingSetIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// StoreGreetingSet represents a GreetingSet event raised by the Store contract.
type StoreGreetingSet struct {
	Greeting string
	Raw      types.Log // Blockchain specific contextual infos
}

// FilterGreetingSet is a free log retrieval operation binding the contract event 0xad181ee258ff92d26bf7ed2e6b571ef1cba3afc45f028b863b0f02adaffc2f06.
//
// Solidity: event GreetingSet(string greeting)
func (_Store *StoreFilterer) FilterGreetingSet(opts *bind.FilterOpts) (*StoreGreetingSetIterator, error) {

	logs, sub, err := _Store.contract.FilterLogs(opts, "GreetingSet")
	if err != nil {
		return nil, err
	}
	return &StoreGreetingSetIterator{contract: _Store.contract, event: "GreetingSet", logs: logs, sub: sub}, nil
}

// WatchGreetingSet is a free log subscription operation binding the contract event 0xad181ee258ff92d26bf7ed2e6b571ef1cba3afc45f028b863b0f02adaffc2f06.
//
// Solidity: event GreetingSet(string greeting)
func (_Store *StoreFilterer) WatchGreetingSet(opts *bind.WatchOpts, sink chan<- *StoreGreetingSet) (event.Subscription, error) {

	logs, sub, err := _Store.contract.WatchLogs(opts, "GreetingSet")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(StoreGreetingSet)
				if err := _Store.contract.UnpackLog(event, "GreetingSet", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseGreetingSet is a log parse operation binding the contract event 0xad181ee258ff92d26bf7ed2e6b571ef1cba3afc45f028b863b0f02adaffc2f06.
//
// Solidity: event GreetingSet(string greeting)
func (_Store *StoreFilterer) ParseGreetingSet(log types.Log) (*StoreGreetingSet, error) {
	event := new(StoreGreetingSet)
	if err := _Store.contract.UnpackLog(event, "GreetingSet", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

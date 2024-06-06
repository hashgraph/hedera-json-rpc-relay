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
	Bin: "0x608060405234801561000f575f80fd5b50604051610bc8380380610bc8833981810160405281019061003191906101ca565b805f908161003f919061041e565b507fad181ee258ff92d26bf7ed2e6b571ef1cba3afc45f028b863b0f02adaffc2f068160405161006f9190610535565b60405180910390a150610555565b5f604051905090565b5f80fd5b5f80fd5b5f80fd5b5f80fd5b5f601f19601f8301169050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b6100dc82610096565b810181811067ffffffffffffffff821117156100fb576100fa6100a6565b5b80604052505050565b5f61010d61007d565b905061011982826100d3565b919050565b5f67ffffffffffffffff821115610138576101376100a6565b5b61014182610096565b9050602081019050919050565b8281835e5f83830152505050565b5f61016e6101698461011e565b610104565b90508281526020810184848401111561018a57610189610092565b5b61019584828561014e565b509392505050565b5f82601f8301126101b1576101b061008e565b5b81516101c184826020860161015c565b91505092915050565b5f602082840312156101df576101de610086565b5b5f82015167ffffffffffffffff8111156101fc576101fb61008a565b5b6102088482850161019d565b91505092915050565b5f81519050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f600282049050600182168061025f57607f821691505b6020821081036102725761027161021b565b5b50919050565b5f819050815f5260205f209050919050565b5f6020601f8301049050919050565b5f82821b905092915050565b5f600883026102d47fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff82610299565b6102de8683610299565b95508019841693508086168417925050509392505050565b5f819050919050565b5f819050919050565b5f61032261031d610318846102f6565b6102ff565b6102f6565b9050919050565b5f819050919050565b61033b83610308565b61034f61034782610329565b8484546102a5565b825550505050565b5f90565b610363610357565b61036e818484610332565b505050565b5b81811015610391576103865f8261035b565b600181019050610374565b5050565b601f8211156103d6576103a781610278565b6103b08461028a565b810160208510156103bf578190505b6103d36103cb8561028a565b830182610373565b50505b505050565b5f82821c905092915050565b5f6103f65f19846008026103db565b1980831691505092915050565b5f61040e83836103e7565b9150826002028217905092915050565b61042782610211565b67ffffffffffffffff8111156104405761043f6100a6565b5b61044a8254610248565b610455828285610395565b5f60209050601f831160018114610486575f8415610474578287015190505b61047e8582610403565b8655506104e5565b601f19841661049486610278565b5f5b828110156104bb57848901518255600182019150602085019450602081019050610496565b868310156104d857848901516104d4601f8916826103e7565b8355505b6001600288020188555050505b505050505050565b5f82825260208201905092915050565b5f61050782610211565b61051181856104ed565b935061052181856020860161014e565b61052a81610096565b840191505092915050565b5f6020820190508181035f83015261054d81846104fd565b905092915050565b610666806105625f395ff3fe608060405234801561000f575f80fd5b5060043610610034575f3560e01c8063a413686214610038578063cfae321714610054575b5f80fd5b610052600480360381019061004d9190610297565b610072565b005b61005c6100bb565b604051610069919061033e565b60405180910390f35b805f90816100809190610561565b507fad181ee258ff92d26bf7ed2e6b571ef1cba3afc45f028b863b0f02adaffc2f06816040516100b0919061033e565b60405180910390a150565b60605f80546100c99061038b565b80601f01602080910402602001604051908101604052809291908181526020018280546100f59061038b565b80156101405780601f1061011757610100808354040283529160200191610140565b820191905f5260205f20905b81548152906001019060200180831161012357829003601f168201915b5050505050905090565b5f604051905090565b5f80fd5b5f80fd5b5f80fd5b5f80fd5b5f601f19601f8301169050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b6101a982610163565b810181811067ffffffffffffffff821117156101c8576101c7610173565b5b80604052505050565b5f6101da61014a565b90506101e682826101a0565b919050565b5f67ffffffffffffffff82111561020557610204610173565b5b61020e82610163565b9050602081019050919050565b828183375f83830152505050565b5f61023b610236846101eb565b6101d1565b9050828152602081018484840111156102575761025661015f565b5b61026284828561021b565b509392505050565b5f82601f83011261027e5761027d61015b565b5b813561028e848260208601610229565b91505092915050565b5f602082840312156102ac576102ab610153565b5b5f82013567ffffffffffffffff8111156102c9576102c8610157565b5b6102d58482850161026a565b91505092915050565b5f81519050919050565b5f82825260208201905092915050565b8281835e5f83830152505050565b5f610310826102de565b61031a81856102e8565b935061032a8185602086016102f8565b61033381610163565b840191505092915050565b5f6020820190508181035f8301526103568184610306565b905092915050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f60028204905060018216806103a257607f821691505b6020821081036103b5576103b461035e565b5b50919050565b5f819050815f5260205f209050919050565b5f6020601f8301049050919050565b5f82821b905092915050565b5f600883026104177fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff826103dc565b61042186836103dc565b95508019841693508086168417925050509392505050565b5f819050919050565b5f819050919050565b5f61046561046061045b84610439565b610442565b610439565b9050919050565b5f819050919050565b61047e8361044b565b61049261048a8261046c565b8484546103e8565b825550505050565b5f90565b6104a661049a565b6104b1818484610475565b505050565b5b818110156104d4576104c95f8261049e565b6001810190506104b7565b5050565b601f821115610519576104ea816103bb565b6104f3846103cd565b81016020851015610502578190505b61051661050e856103cd565b8301826104b6565b50505b505050565b5f82821c905092915050565b5f6105395f198460080261051e565b1980831691505092915050565b5f610551838361052a565b9150826002028217905092915050565b61056a826102de565b67ffffffffffffffff81111561058357610582610173565b5b61058d825461038b565b6105988282856104d8565b5f60209050601f8311600181146105c9575f84156105b7578287015190505b6105c18582610546565b865550610628565b601f1984166105d7866103bb565b5f5b828110156105fe578489015182556001820191506020850194506020810190506105d9565b8683101561061b5784890151610617601f89168261052a565b8355505b6001600288020188555050505b50505050505056fea2646970667358221220907b4d4a3c4c9fede0b34e94670b0dd58697ce894122fc86a4adedc1fc4c508e64736f6c63430008190033",
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

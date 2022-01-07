---
eip: 2
title: 家园硬分叉变化
author: Vitalik Buterin <v@buterin.com>
status: Final
type: Standards Track
category: Core
created: 2015-11-15
---

### 元引用

[Homestead](./eip-606.md).

### 参数

| FORK_BLKNUM | CHAIN_NAME      |
| ----------- | --------------- |
| 1,150,000   | Main net        |
| 494,000     | Morden          |
| 0           | Future testnets |

# 规范

如果`block.number >= HOMESTEAD_FORK_BLKNUM`，请执行以下操作：

1. *通过交易创建合约的 gas 成本*从 21,000 增加至 53,000，例如，如果要发送一个交易，并且接收地址是空字符串，减去的初始 gas 是 53,000 加上 tx 数据的 gas 成本，而不是现在的 21,000。在一个合约中使用 `CREATE` 操作码创建合约，不受影响。
2. 所有交易签名中，s 值大于 `secp256k1n/2` 的视为无效。预编译的 ECDSA 复原合约保持不变，将接受较高 s 值；例如，如果合约在复原旧的比特币签名时，此功能便发挥其作用。
3. 创建合约时，如果没有足够的 gas 来支付最终费用，从而将合约代码添加至状态中，则合约创建失败（如 gas 消耗殆尽），而非创建一个空白合约。
4. 从当前的方程中改变难度调整算法：`block_diff = parent_diff + parent_diff // 2048 * (1 if block_timestamp - parent_timestamp < 13 else -1) + int(2**((block.number // 100000) - 2))` （其中 `int(2**((block.number // 100000) - 2))` 表示指数难度调整组成）为 `block_diff = parent_diff + parent_diff // 2048 * max(1 - (block_timestamp - parent_timestamp) // 10, -99) + int(2**((block.number // 100000) - 2))`，其中 // 是整数除法运算符，例如，`6 // 2 = 3`, `7 // 2 = 3`, `8 // 2 = 4`。`minDifficulty` 仍用于定义可被接受的最低难度，任何调整都不能低于此难度。

# 原理阐述

Currently, there is an excess incentive to create contracts via transactions, where the cost is 21,000, rather than contracts, where the cost is 32,000. Additionally, with the help of suicide refunds, it is currently possible to make a simple ether value transfer using only 11,664 gas; the code for doing this is as follows:

目前，通过交易创建合约的动机过强，其成本是 21,000 gas，而非通过成本为 32,000 gas 的合约创建。此外，在 SUICIDE 退款的帮助下，目前只需使用 11,664 gas 就可以完成一个简单的以太坊价值转移；实现该操作的代码如下：

```python
from ethereum import tester as t
> from ethereum import utils
> s = t.state()
> c = s.abi_contract('def init():\n suicide(0x47e25df8822538a8596b28c637896b4d143c351e)', endowment=10**15)
> s.block.get_receipts()[-1].gas_used
11664
> s.block.get_balance(utils.normalize_address(0x47e25df8822538a8596b28c637896b4d143c351e))
1000000000000000
```
这不是一个特别严重的问题，但可以说是一个漏洞。

允许具有任意 `0 < s < secp256k1n` 任意 s 值的交易，如目前的情况一样，打开一个交易延展性问题，由于可以接受任何交易，将 s 值从 `s` 翻转到 `secp256k1n - s`，翻转 v 值（`27 -> 28`, `28 -> 27`），最终签名仍然有效。这不是一个严重的安全缺陷，尤其是以太坊使用地址而非交易哈希值对以太坊价值转移或其他交易进行输入，但它仍然会对用户界面造成不便，因为攻击者可以让在一个区块中得到确认的交易与任何用户发送的交易产生不同的哈希值，对使用交易哈希值作为追踪 ID 的用户界面造成干扰。防止出现较高的 s 值以消除该问题。

创建合约时，如果没有足够的 gas 来支付最终 gas 费用，将有以下优势：
- (i) 在创建合约过程中，其结果将呈现一个更直观的区别："成功或失败"，而不是出现当前的 “成功、失败或空白合约”这三种情况；
- (ii) 更容易发现失败的结果，除非合约创建完全成功，否则不会创建任何合约账户；
- (iii) 捐赠时，创建合约更加安全，因为此时会产生保证，或者整个启动过程发生，或者交易失败、退还捐赠。

难度调整的变化最终解决了以太坊协议两个月前遇到的问题，即大量矿工在包含时间戳等于`parent_timestamp + 1`的区块中挖矿；这使得区块时间分布出现偏差，因此，目前的区块时间算法目标为 13 秒的*中位数*，继续保持中位数目标不变，但其平均值开始增加。如果 51% 的矿工以这种方式在区块中挖矿，平均值将无限增大。因此，建议新公式以平均值为目标；事实证明，使用该方程时，超过 24 秒的平均区块时间在数学上是不可能长期实现的。

使用 ``(block_timestamp - parent_timestamp) // 10`` 作为主要输入变量，而非直接使用时间差，是为了保持算法的粗粒度，防止过度激励将时间差设置为 1，以创建一个难度较高的区块，从而保证击败任何可能产生的分叉。-99 的上限，只是用于确保两个区块由于客户端安全漏洞或其它黑天鹅问题，在时间上恰巧相隔很远时，难度不会大幅下降。

# 实现

这里用 Python 实现了这一点：

1. https://github.com/ethereum/pyethereum/blob/d117c8f3fd93359fc641fd850fa799436f7c43b5/ethereum/processblock.py#L130
2. https://github.com/ethereum/pyethereum/blob/d117c8f3fd93359fc641fd850fa799436f7c43b5/ethereum/processblock.py#L129
3. https://github.com/ethereum/pyethereum/blob/d117c8f3fd93359fc641fd850fa799436f7c43b5/ethereum/processblock.py#L304
4. https://github.com/ethereum/pyethereum/blob/d117c8f3fd93359fc641fd850fa799436f7c43b5/ethereum/blocks.py#L42

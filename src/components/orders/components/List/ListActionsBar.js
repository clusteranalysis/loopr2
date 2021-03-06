import React from 'react';
import {connect} from 'dva'
import ListFiltersForm from './ListFiltersForm'
import {Button, Modal} from 'antd'
import {generateCancelAllOrdresTx, generateCancelOrdersByTokenPairTx} from 'Loopring/relay/order';
import {notifyTransactionSubmitted} from 'Loopring/relay/utils'
import {toHex} from 'Loopring/common/formatter'
import {configs} from "../../../../common/config/data";
import config from "../../../../common/config";
import intl from 'react-intl-universal';

function ListActionsBar(props) {
  const {actions = {}, LIST = {}, className, account, gasPrice, contractAddress,id} = props;
  const {dispatch} = props;
  const {filters = {}} = LIST[id] || {}
  const tokenPair = filters.market;
  const refresh = ()=>{
    dispatch({
      type:'orders/filtersChange',
      payload:{
        id:'orders/trade',
      }
    })
  }
  const cancelAll = () => {
    Modal.confirm({
      title: intl.get('order.confirm_cancel_all',{pair:tokenPair}),
      onOk: async () => {
        const seconds = toHex(Math.ceil(new Date().getTime() / 1e3));
        const nonce = await window.STORAGE.wallet.getNonce(account.address);
        const params = {
          gasPrice: toHex(gasPrice * 1e9),
          timestamp: seconds,
          protocolAddress: contractAddress,
          nonce: toHex(nonce)
        };
        let tx;
        if (tokenPair) {
          const tokenA = tokenPair.split('-')[0];
          const tokenB = tokenPair.split('-')[1];
          tx = generateCancelOrdersByTokenPairTx({
            ...params,
            gasLimit: config.getGasLimitByType('cancelOrderByTokenPair') ? config.getGasLimitByType('cancelOrderByTokenPair').gasLimit : configs['defaultGasLimit'],
            tokenA: window.CONFIG.getTokenBySymbol(tokenA === 'ETH' ? 'WETH' : tokenA).address,
            tokenB: window.CONFIG.getTokenBySymbol(tokenB === 'ETH' ? 'WETH' : tokenB).address
          })
        } else {
          tx = generateCancelAllOrdresTx({
            ...params,
            gasLimit: config.getGasLimitByType('cancelAllOrder') ? config.getGasLimitByType('cancelAllOrder').gasLimit : configs['defaultGasLimit'],
          })
        }

        window.WALLET.sendTransaction(tx).then((res) => {
          if (!res.error) {
            window.STORAGE.transactions.addTx({hash: res.result, owner: account.address});
            window.STORAGE.wallet.setWallet({address:window.WALLET.getAddress(),nonce:tx.nonce})
            notifyTransactionSubmitted(res.result);
            Modal.success({
              title: intl.get('order.cancel_all_success',{pair:tokenPair}),
              content: <div>Transaction hash is : <a className='color-blue-500' href={`https://etherscan.io/tx/${res.result}`} target='_blank'> {window.uiFormatter.getShortAddress(res.result)}</a></div>
            })
          } else {
            Modal.error({
              title: intl.get('order.cancel_all_failed',{pair:tokenPair}),
              content: res.error.message
            })
          }
        });


      },
      onCancel: () => {
      },
      okText: intl.get('order.yes'),
      cancelText: intl.get('order.no'),
    })
  }
  return (
    <div className={className}>
      <div className="row ml0 mr0 align-items-center">
        <div className="col-auto">
          <ListFiltersForm actions={actions} LIST={LIST[id]} id={id} />
        </div>
        <div className="col">

        </div>
        {false && <div className="col-auto pr0">
          <Button type="default" onClick={refresh}>{intl.get('order.refresh')}</Button>
        </div>}
        <div className="col-auto">
          <Button type="primary" onClick={cancelAll}>{intl.get('order.cancel_all')}</Button>
        </div>
      </div>
    </div>
  )
}

function mapStateToProps(state) {
  return {
    account: state.account,
    gasPrice: state.settings.trading.gasPrice,
    contractAddress: state.settings.trading.contract.address
  };
}

export default connect(mapStateToProps)(ListActionsBar)

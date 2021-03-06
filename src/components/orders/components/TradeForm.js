import React from 'react';
import {connect} from 'dva';
import {Form,InputNumber,Button,Icon,Modal,Input,Radio,Select,Checkbox,Slider,Collapse,Tooltip} from 'antd';
import * as fm from '../../../common/Loopring/common/formatter'
import {accAdd, accSub, accMul, accDiv} from '../../../common/Loopring/common/math'
import {configs} from '../../../common/config/data'
import config from '../../../common/config'
import Currency from '../../../modules/settings/CurrencyContainer'
import {getEstimatedAllocatedAllowance, getFrozenLrcFee} from '../../../common/Loopring/relay/utils'
import intl from 'react-intl-universal';

class TradeForm extends React.Component {
  state = {
    priceInput: 0,
    availableAmount: 0,
    timeToLivePopularSetting: true
  }

  componentDidMount() {
    const {side, pair, assets} = this.props
    if (side === 'sell') {
      const tokenL = pair.split('-')[0].toUpperCase()
      const tokenLBalance = {...window.CONFIG.getTokenBySymbol(tokenL), ...assets.getTokenBySymbol(tokenL)}
      this.setState({availableAmount: tokenLBalance.balance})
    }
  }

  render() {
    const tokenDivDigist = (token) => {
      const tokenCopy = {...token}
      tokenCopy.balance = tokenCopy.balance > 0 ? fm.toBig(tokenCopy.balance).div("1e"+tokenCopy.digits) : fm.toBig(0)
      tokenCopy.allowance = tokenCopy.allowance > 0 ? fm.toBig(tokenCopy.allowance).div("1e"+tokenCopy.digits) : fm.toBig(0)
      return tokenCopy
    }
    const RadioButton = Radio.Button;
    const RadioGroup = Radio.Group;
    const {form, dispatch, side = 'sell', pair = 'LRC-WETH',assets,prices,tickersByLoopring,tickersByPair,account,settings} = this.props
    const tickerByLoopring = tickersByLoopring.getTickerByMarket(pair)
    const tokenL = pair.split('-')[0].toUpperCase()
    const tokenR = pair.split('-')[1].toUpperCase()
    const tokenLBalanceOriginal = {...config.getTokenBySymbol(tokenL), ...assets.getTokenBySymbol(tokenL)}
    const tokenLBalance = tokenDivDigist(tokenLBalanceOriginal)
    const tokenRBalanceOriginal = {...config.getTokenBySymbol(tokenR), ...assets.getTokenBySymbol(tokenR)}
    const tokenRBalance = tokenDivDigist(tokenRBalanceOriginal)
    const marketConfig = window.CONFIG.getMarketBySymbol(tokenL, tokenR)
    const tokenRPrice = prices.getTokenBySymbol(tokenR)
    const integerReg = new RegExp("^[0-9]*$")
    const amountReg = new RegExp("^(([0-9]+\\.[0-9]*[1-9][0-9]*)|([0-9]*[1-9][0-9]*\\.[0-9]+)|([0-9]*[1-9][0-9]*))$")
    const TokenFormatter = window.uiFormatter.TokenFormatter
    let fmL = new TokenFormatter({symbol:tokenL})
    let fmR = new TokenFormatter({symbol:tokenR})
    let displayPrice = tickerByLoopring ? tickerByLoopring.last : 0
    const priceArr = displayPrice.toString().split(".")
    if (priceArr[1] && priceArr[1].length > marketConfig.pricePrecision) {
      try {
        displayPrice = Number(priceArr[0] + "." + priceArr[1].substring(0, marketConfig.pricePrecision))
      } catch (e) {
        console.error(e)
        displayPrice = 0
      }
    }

    const showModal = (payload)=>{
      dispatch({
        type: 'modals/modalChange',
        payload: {
          ...payload,
          visible: true,
        }
      })
    }

    const gotoError = (errors, e) => {
      if(e) e.stopPropagation()
      showModal({
        id: 'trade/place-order-error',
        errors,
      })
    }

    const showTradeModal = (tradeInfo) => {
      dispatch({
        type: 'modals/modalChange',
        payload: {
          id: 'trade/confirm',
          visible: true,
          side,
          pair,
          ...tradeInfo
        }
      })
    }

    function handleSubmit() {
      if(!window.WALLET_UNLOCK_TYPE) {
        return
      }
      form.validateFields((err, values) => {
        if (!err) {
          const tradeInfo = {}
          tradeInfo.amount = Number(values.amount)
          tradeInfo.price = Number(values.price)
          tradeInfo.total = accMul(tradeInfo.amount, tradeInfo.price)
          if(this.state.timeToLivePopularSetting && values.timeToLivePopularSetting) {
            let timeToLive = 0
            switch(values.timeToLivePopularSetting){
              case '1hour': timeToLive = 3600; break;
              case '1day': timeToLive = 24 * 86400; break;
              case '1week': timeToLive = 7 * 24 * 86400; break;
              case '1month': timeToLive = 30 * 24 * 86400; break;
              default :
                console.error("invalid timeToLivePopularSetting:", values.timeToLivePopularSetting)
                return
            }
            tradeInfo.timeToLive = timeToLive
          } else if (values.timeToLiveUnit && values.timeToLive) {
            let timeToLive = Number(values.timeToLive)
            switch(values.timeToLiveUnit) {
              case 'second': break;
              case 'minute': timeToLive = timeToLive * 60; break;
              case 'hour': timeToLive = timeToLive * 3600; break;
              case 'day': timeToLive = timeToLive * 86400; break;
              default :
                console.error("invalid timeToLiveUnit:", values.timeToLiveUnit)
                return
            }
            tradeInfo.timeToLive = timeToLive
          }
          if (values.marginSplit) {
            tradeInfo.marginSplit = Number(values.marginSplit)
          }
          const totalWorth = calculateWorthInLegalCurrency(tokenR, tradeInfo.total)
          if(totalWorth <= 0) {
            Modal.error({
              title: 'Error',
              content: "Failed fetch data from server",
            });
            return
          }
          let milliLrcFee = 0
          if (values.lrcFee) {
            milliLrcFee = Number(values.lrcFee)
            tradeInfo.milliLrcFee = milliLrcFee
          } else {
            milliLrcFee = Number(configs.defaultLrcFeePermillage)
          }
          let userSetLrcFeeInEth = calculateLrcFeeInEth(totalWorth, milliLrcFee)
          const minimumLrcfeeInEth = configs.minimumLrcfeeInEth
          if(userSetLrcFeeInEth >= minimumLrcfeeInEth){
            tradeInfo.lrcFee = calculateLrcFeeByEth(userSetLrcFeeInEth)
            toConfirm(tradeInfo)
          } else {
            tradeInfo.lrcFee = calculateLrcFeeByEth(minimumLrcfeeInEth)
            const content = intl.get('trade.lrcFee_increased', {userSet:calculateLrcFeeByEth(userSetLrcFeeInEth), increased:tradeInfo.lrcFee})
            showConfirm(content, tradeInfo)
          }
        }
      });
    }

    function showConfirm(content, tradeInfo) {
      Modal.confirm({
        title: intl.get('trade.notice'),
        content: content,
        onOk: toConfirm.bind(this, tradeInfo),
        onCancel() {},
      });
    }

    function cutDecimal(number, decimail) {
      const d = new Number("1e"+decimail)
      return Math.floor(accMul(number, d)) / d
    }

    function ceilDecimal(number, decimail) {
      const d = new Number("1e"+decimail)
      return Math.ceil(accMul(number, d)) / d
    }

    async function toConfirm(tradeInfo) {
      const configR = config.getTokenBySymbol(tokenR)
      const configL = config.getTokenBySymbol(tokenL)
      const ethBalance = fm.toBig(assets.getTokenBySymbol('ETH').balance).div(1e18)
      const approveGasLimit = config.getGasLimitByType('approve').gasLimit
      const frozenAmountLResult = await getEstimatedAllocatedAllowance(window.WALLET.getAddress(), tokenL)
      const frozenAmountRResult = await getEstimatedAllocatedAllowance(window.WALLET.getAddress(), tokenR)
      const lrcBalance = tokenDivDigist({...config.getTokenBySymbol('LRC'), ...assets.getTokenBySymbol('LRC')})
      let tokenBalanceS = null, tokenBalanceB = null
      let frozenAmountS = null
      if(side === 'buy') {//buy eos-weth
        tokenBalanceS = tokenRBalance
        tokenBalanceB = tokenLBalance
        frozenAmountS = fm.toBig(frozenAmountRResult.result).div('1e'+configR.digits).add(fm.toBig(tradeInfo.total))
      } else {//sell eos-weth
        tokenBalanceS = tokenLBalance
        tokenBalanceB = tokenRBalance
        frozenAmountS = fm.toBig(frozenAmountLResult.result).div('1e'+configL.digits).add(fm.toBig(tradeInfo.amount))
      }
      let approveCount = 0
      const warn = new Array()
      if(tokenBalanceB.symbol === 'LRC') { //buy lrc, only verify eth balance could cover gas cost if approve is needed
        if(tokenBalanceS.balance.lessThan(frozenAmountS)) {
          warn.push({type:"BalanceNotEnough", value:{symbol:tokenBalanceS.symbol, balance:cutDecimal(tokenBalanceS.balance.toNumber(),6), required:ceilDecimal(frozenAmountS.sub(tokenBalanceS.balance).toNumber(),6)}})
        }
        if(frozenAmountS.greaterThan(tokenBalanceS.allowance)) {
          warn.push({type:"AllowanceNotEnough", value:{symbol:tokenBalanceS.symbol, allowance:cutDecimal(tokenBalanceS.allowance.toNumber(),6), required:ceilDecimal(frozenAmountS.sub(tokenBalanceS.allowance).toNumber(),6)}})
          approveCount += 1
          if(tokenBalanceS.allowance.greaterThan(0)) approveCount += 1
        }
        const gas = fm.toBig(settings.trading.gasPrice).times(fm.toNumber(approveGasLimit)).div(1e9).times(approveCount)
        if(ethBalance.lessThan(gas)){
          const errors = new Array()
          errors.push({type:"BalanceNotEnough", value:{symbol:'ETH', balance:cutDecimal(ethBalance.toNumber(),6), required:ceilDecimal(gas.sub(ethBalance).toNumber(),6)}})
          gotoError(errors)
          return
        }
      } else {
        //lrc balance not enough, lrcNeed = frozenLrc + lrcFee
        const frozenLrcFee = await getFrozenLrcFee(window.WALLET.getAddress())
        let frozenLrc = fm.toBig(frozenLrcFee.result).div(1e18).add(fm.toBig(tradeInfo.lrcFee))
        if(lrcBalance.balance.lessThan(frozenLrc)){
          const errors = new Array()
          errors.push({type:"BalanceNotEnough", value:{symbol:'LRC', balance:cutDecimal(lrcBalance.balance.toNumber(), 6), required:ceilDecimal(frozenLrc.sub(lrcBalance.balance).toNumber(),6)}})
          gotoError(errors)
          return
        }
        const frozenLrcInOrderResult = await getEstimatedAllocatedAllowance(window.WALLET.getAddress(), "LRC")
        frozenLrc = frozenLrc.add(fm.toBig(frozenLrcInOrderResult.result).div(1e18))
        if(tokenL === 'LRC' && side === 'sell') {// sell lrc-weth
          frozenLrc = frozenLrc.add(fm.toBig(tradeInfo.amount))
        }
        if(tokenR === 'LRC' && side === 'buy'){// buy eos-lrc
          frozenLrc = frozenLrc.add(fm.toBig(tradeInfo.total))
        }
        // verify tokenL/tokenR balance and allowance cause gas cost
        if(tokenBalanceS.symbol === 'LRC') {
          frozenAmountS = frozenLrc
        }
        if(tokenBalanceS.balance.lessThan(frozenAmountS)) {
          warn.push({type:"BalanceNotEnough", value:{symbol:tokenBalanceS.symbol, balance:cutDecimal(tokenBalanceS.balance.toNumber(),6), required:ceilDecimal(frozenAmountS.sub(tokenBalanceS.balance).toNumber(),6)}})
        }
        if(tokenBalanceS.allowance.lessThan(frozenAmountS)) {
          warn.push({type:"AllowanceNotEnough", value:{symbol:tokenBalanceS.symbol, allowance:cutDecimal(tokenBalanceS.allowance.toNumber(),6), required:ceilDecimal(frozenAmountS.sub(tokenBalanceS.allowance).toNumber(),6)}})
          approveCount += 1
          if(tokenBalanceS.allowance.greaterThan(0)) approveCount += 1
        }
        // lrcFee allowance
        if(frozenLrc.greaterThan(lrcBalance.allowance) && tokenBalanceS.symbol !== 'LRC') {
          warn.push({type:"AllowanceNotEnough", value:{symbol:"LRC", allowance:cutDecimal(lrcBalance.allowance.toNumber(),6), required:ceilDecimal(frozenLrc.sub(lrcBalance.allowance).toNumber(),6)}})
          approveCount += 1
          if(lrcBalance.allowance.greaterThan(0)) approveCount += 1
        }
        const gas = fm.toBig(settings.trading.gasPrice).times(approveGasLimit).div(1e9).times(approveCount).toNumber()
        if(ethBalance.lessThan(gas)){
          const errors = new Array()
          errors.push({type:"BalanceNotEnough", value:{symbol:'ETH', balance:cutDecimal(ethBalance.toNumber(),6), required:ceilDecimal(gas.sub(ethBalance).toNumber(),6)}})
          gotoError(errors)
          return
        }
      }
      if(warn.length >0) {
        tradeInfo.warn = warn
      }
      showTradeModal(tradeInfo)
    }

    function calculateWorthInLegalCurrency(symbol, amount) {
      const price = prices.getTokenBySymbol(symbol).price
      return accMul(amount, price)
    }

    function calculateLrcFeeInEth(totalWorth, milliLrcFee) {
      const price = prices.getTokenBySymbol("eth").price
      return accDiv(accDiv(accMul(totalWorth, milliLrcFee), 1000), price)
    }

    function calculateLrcFeeInLrc(totalWorth) {
      const price = prices.getTokenBySymbol("lrc").price
      return accDiv(Math.floor(accMul(accDiv(totalWorth, price), 100)), 100)
    }

    function calculateLrcFeeByEth(ethAmount) {
      const ethPrice = prices.getTokenBySymbol("eth").price
      const lrcPrice = prices.getTokenBySymbol("lrc").price
      const price = accDiv(lrcPrice, ethPrice)
      return accDiv(Math.floor(accMul(accDiv(ethAmount, price), 100)), 100)
    }

    function handleCancle() {
    }

    function handleReset() {
      form.resetFields()
    }

    function validateAmount(value) {
      // const amount = Number(value)
      // const price = Number(form.getFieldValue("price"))
      // if (amount <= 0) return false
      // if (side === 'sell') {
      //   return amount <= tokenLBalance.balance
      // } else {
      //   if (price > 0) {
      //     return accMul(price, amount) <= tokenRBalance.balance
      //   } else {
      //     return true
      //   }
      // }
      return value > 0
    }

    function validatePirce(value) {
      const result = form.validateFields(["amount"], {force:true})
      return Number(value) > 0
    }

    function validateLrcFee(value) {
      if (value) {
        const v = Number(value)
        return v > 0 && v <= 50
      } else {
        return true
      }
    }

    function validateMarginSplit(value) {
      if (value) {
        const v = Number(value)
        return v >= 0 && v <= 100
      } else {
        return true
      }
    }

    function validateOptionInteger(value) {
      if (value) {
        return integerReg.test(value)
      } else {
        return true
      }
    }

    function inputChange(type, e) {
      let price = 0, amount = 0
      if (type === 'price') {
        price = e.target.value.toString()
        if (!amountReg.test(price)) return false
        const priceArr = price.split(".")
        if (priceArr[1] && priceArr[1].length > marketConfig.pricePrecision) {
          try {
            price = Number(priceArr[0] + "." + priceArr[1].substring(0, marketConfig.pricePrecision))
          } catch (e) {
            console.error(e)
            price = 0
          }
          e.target.value = price
        }
        this.setState({priceInput: price})
        amount = Number(form.getFieldValue("amount"))
        if(side === 'buy'){
          const precision = Math.max(0,tokenRBalance.precision - marketConfig.pricePrecision)
          const availableAmount = Math.floor(tokenRBalance.balance / Number(price) * ("1e"+precision)) / ("1e"+precision)
          this.setState({availableAmount: availableAmount})
          form.setFieldsValue({"amountSlider":0})
        } else {
          const availableAmount = Math.floor(tokenLBalance.balance * ("1e"+tokenRBalance.precision)) / ("1e"+tokenRBalance.precision)
          this.setState({availableAmount: availableAmount})
        }
      } else if (type === 'amount') {
        amount = e.target.value.toString()
        if (!amountReg.test(amount)) return false
        const amountPrecision = tokenRBalance.precision - marketConfig.pricePrecision
        if (amountPrecision > 0) {
          const amountArr = amount.split(".")
          if (amountArr[1] && amountArr[1].length > amountPrecision) {
            try {
              amount = Number(amountArr[0] + "." + amountArr[1].substring(0, amountPrecision))
            } catch (e) {
              console.error(e)
              amount = 0
            }
          }
        } else {
          amount = Math.floor(amount)
        }
        e.target.value = amount
        price = Number(form.getFieldValue("price"))
      }
      const total = accMul(price, amount)
      form.setFieldsValue({"total": total})
    }

    function timeToLiveChange(e) {
      e.preventDefault();
      this.setState({timeToLivePopularSetting: !this.state.timeToLivePopularSetting})
    }

    function amountSliderChange(e) {
      if(this.state.availableAmount > 0) {
        const amount = accMul(this.state.availableAmount, Number(e)) / 100
        form.setFieldsValue({"amount": amount})
        const price = Number(form.getFieldValue("price"))
        const total = accMul(price, amount)
        form.setFieldsValue({"total": total})
      }
    }

    const formItemLayout = {
      labelCol: {
        xs: {span: 24},
        sm: {span: 6},
      },
      wrapperCol: {
        xs: {span: 24},
        sm: {span: 18},
      },
    };
    const Option = Select.Option;
    const timeToLiveSelectAfter = form.getFieldDecorator('timeToLiveUnit', {
      initialValue: "second",
      rules: []
    })(
      <Select style={{width: 90}}>
        <Option value="second">{intl.get('trade.second')}</Option>
        <Option value="minute">{intl.get('trade.minute')}</Option>
        <Option value="hour">{intl.get('trade.hour')}</Option>
        <Option value="day">{intl.get('trade.day')}</Option>
      </Select>
    )

    const marks = {
      0: '0',
      25: '25％',
      50: '50％',
      75: '75％',
      100: '100％'
    };

    const amountSlider = form.getFieldDecorator('amountSlider', {
      initialValue: 0,
      rules: []
    })(
      <Slider min={0} max={100} marks={marks} onChange={amountSliderChange.bind(this)} disabled={this.state.availableAmount <= 0}/>
    )
    const priceValue = (
      <span className="fs10">
        ≈
        <Currency />
        {this.state.priceInput >0 ? accMul(this.state.priceInput, tokenRPrice.price).toFixed(2) : accMul(displayPrice, tokenRPrice.price).toFixed(2)}
      </span>
    )

    return (
      <div>
        <Form layout="horizontal">
          <Form.Item>
            <div className="row">
              <div className="col fs18 color-grey-900 text-capitalize">{side === "sell" ? intl.get('trade.sell') : intl.get('trade.buy')} {tokenL}</div>
              <div className="col-auto">
                {
                  side === 'buy' ? `${tokenR} ${intl.get('trade.balance')}: ${fmR.getAmount(tokenRBalanceOriginal.balance)}` : `${tokenL} ${intl.get('trade.balance')}: ${fmL.getAmount(tokenLBalanceOriginal.balance)}`
                }
              </div>
            </div>
          </Form.Item>
          <Form.Item label={intl.get('trade.price')} {...formItemLayout} colon={false} extra={
            <div className="row">
              <div className="col fs10">{priceValue}</div>
            </div>
          }>
            {form.getFieldDecorator('price', {
              initialValue: displayPrice,
              rules: [{
                message: intl.get('trade.price_verification_message'),
                validator: (rule, value, cb) => validatePirce(value) ? cb() : cb(true)
              }]
            })(
              <Input className="d-block w-100" placeholder="" size="large" suffix={tokenR}
                     onChange={inputChange.bind(this, 'price')}
                     onFocus={() => {
                       const amount = form.getFieldValue("price")
                       if (amount === 0) {
                         form.setFieldsValue({"price": ''})
                       }
                     }}
                     onBlur={() => {
                       const amount = form.getFieldValue("price")
                       if (amount === '') {
                         form.setFieldsValue({"price": 0})
                       }
                     }}/>
            )}
          </Form.Item>
          <Form.Item label={intl.get('trade.amount')} {...formItemLayout} colon={false} extra={
            <div>
              <div className="fs10">{`${intl.get('trade.available_amount')} ${this.state.availableAmount}`}</div>
              <div className="fs10">{amountSlider}</div>
            </div>
          }>
            {form.getFieldDecorator('amount', {
              initialValue: 0,
              rules: [{
                message: intl.get('trade.amount_verification_message'),
                validator: (rule, value, cb) => validateAmount(value) ? cb() : cb(true)
              }]
            })(
              <Input placeholder="" size="large" suffix={tokenL} onChange={inputChange.bind(this, 'amount')}
                     onFocus={() => {
                       const amount = Number(form.getFieldValue("amount"))
                       if (amount === 0) {
                         form.setFieldsValue({"amount": ''})
                       }
                     }}
                     onBlur={() => {
                       const amount = form.getFieldValue("amount")
                       if (amount === '') {
                         form.setFieldsValue({"amount": 0})
                       }
                     }}/>
            )}
          </Form.Item>
          <Form.Item className="mb5" label={intl.get('trade.total')} {...formItemLayout} colon={false}>
            {form.getFieldDecorator('total', {
              initialValue: 0,
              rules: []
            })(
              <Input disabled className="d-block w-100" placeholder="" size="large" suffix={tokenR}/>
            )}
          </Form.Item>
          <Collapse bordered={false} defaultActiveKey={[]}>
            <Collapse.Panel className="" style={{border: 'none', margin: '0px -15px', padding: '0px -15px'}}
                            header={<div style={{}}>{intl.get('trade.advanced')}</div>} key="1">
              <div className="row">
                <div className="col-12">
                  {this.state.timeToLivePopularSetting &&
                  <Form.Item className="ttl" colon={false} label={
                    <div className="row">
                      <div className="col-auto">{intl.get('trade.time_to_live')}</div>
                      <div className="col">
                        <Tooltip title={intl.getHTML('trade.tips_time_to_live')}>
                          <Icon className="color-gray-500 mr10" type="question-circle"/>
                        </Tooltip>
                      </div>
                      <div className="col-auto"><a href="" onClick={timeToLiveChange.bind(this)}>{this.state.timeToLivePopularSetting ? intl.get('trade.more') : intl.get('trade.popular_option')}</a></div>
                    </div>
                  }>
                    {form.getFieldDecorator('timeToLivePopularSetting')(
                      <RadioGroup>
                        <RadioButton value="1hour">1 {intl.get('trade.hour')}</RadioButton>
                        <RadioButton value="1day">1 {intl.get('trade.day')}</RadioButton>
                        <RadioButton value="1week">1 {intl.get('trade.week')}</RadioButton>
                        <RadioButton value="1month">1 {intl.get('trade.month')}</RadioButton>
                      </RadioGroup>
                    )}
                  </Form.Item>}
                  {!this.state.timeToLivePopularSetting &&
                  <Form.Item className="mb5 ttl" colon={false} label={
                    <div className="row">
                      <div className="col-auto">
                        {intl.get('trade.time_to_live')}
                      </div>
                      <div className="col">
                        <Tooltip title={intl.getHTML('trade.tips_time_to_live')}>
                          <Icon className="color-gray-500 mr10" type="question-circle"/>
                        </Tooltip>
                      </div>
                      <div className="col-auto"><a href="" onClick={timeToLiveChange.bind(this)}>{this.state.timeToLivePopularSetting ? intl.get('trade.more') : intl.get('trade.popular_option')}</a></div>
                    </div>
                  }>
                    {form.getFieldDecorator('timeToLive', {
                      rules: [{
                        message: intl.get('trade.integer_verification_message'),
                        validator: (rule, value, cb) => validateOptionInteger(value) ? cb() : cb(true)
                      }]
                    })(
                      <Input className="d-block w-100" placeholder={intl.get('trade.time_to_live_input_place_holder')} size="large" addonAfter={timeToLiveSelectAfter}/>
                    )}
                  </Form.Item>}
                </div>
                <div className="col">
                  <Form.Item className="mb5 ttl" colon={false} label={
                    <div className="row">
                      <div className="col-auto">
                        {intl.get('trade.lrc_fee')}
                      </div>
                      <div className="col">
                        <Tooltip title={intl.getHTML('trade.tips_lrc_fee')}>
                          <Icon className="color-gray-500 mr10" type="question-circle"/>
                        </Tooltip>
                      </div>
                    </div>
                  }>
                    {form.getFieldDecorator('lrcFee', {
                      rules: [{
                        message: `${intl.get('trade.integer_verification_message')}(1~50)`,
                        validator: (rule, value, cb) => validateLrcFee(value) ? cb() : cb(true)
                      }]
                    })(
                      <Input className="d-block w-100" placeholder="" size="large" suffix='‰'/>
                    )}
                  </Form.Item>
                </div>
                <div className="col">
                  <Form.Item className="mb5 ttl" colon={false} label={
                    <div className="row">
                      <div className="col-auto">
                        {intl.get('trade.margin_split')}
                      </div>
                      <div className="col">
                        <Tooltip title={intl.getHTML('trade.tips_margin_split')}>
                          <Icon className="color-gray-500 mr10" type="question-circle"/>
                        </Tooltip>
                      </div>
                    </div>
                  }>
                    {form.getFieldDecorator('marginSplit', {
                      rules: [{
                        message: `${intl.get('trade.integer_verification_message')}(0~100)`,
                        validator: (rule, value, cb) => validateMarginSplit(value) ? cb() : cb(true)
                      }]
                    })(
                      <Input className="d-block w-100" placeholder="" size="large" suffix='％'/>
                    )}
                  </Form.Item>
                </div>
              </div>
            </Collapse.Panel>
          </Collapse>
          {account && account.isUnlocked &&
          <Form.Item>
            {
              side == 'buy' &&
              <Button onClick={handleSubmit.bind(this)} type="" className="d-block w-100 bg-green-500 border-none color-white"
                      size="large">
                {intl.get('trade.place_order')}
              </Button>
            }
            {
              side == 'sell' &&
              <Button onClick={handleSubmit.bind(this)} type="" className="d-block w-100 bg-red-500 border-none color-white"
                      size="large">
                {intl.get('trade.place_order')}
              </Button>
            }
          </Form.Item>
          }
          {(!account || !account.isUnlocked) &&
          <div className="bg-blue-grey-50 text-center pt15 pb15" style={{borderRadius:'4px'}}>
            <a className="color-blue-500" onClick={showModal.bind(this,{id:'wallet/unlock', pageFrom:'TradeFrom'})}>{intl.get('trade.unlock_your_wallet')}</a> {intl.get('trade.to_trade')}
          </div>
          }
        </Form>
      </div>
    );
  };
}

export default Form.create()(connect()(TradeForm));

import React from 'react';
import {Link} from 'dva/router';
import {Alert, Button, Form, Icon, Input, Select,message} from 'antd';
import {wallets} from "../../../common/config/data";
import {isValidateMnemonic} from "Loopring/common/mnemonic"
import {fromMnemonic} from 'Loopring/ethereum/account';
import MnemonicUnlockAccount from '../../../modules/account/MnemonicUnlockAccount'
import intl from 'react-intl-universal';

class UnlockByMnemonic extends React.Component {

  state = {
    dpath: null,
    mnemonic: null,
    isMnemonicValid: false,
    password:null,
  };
  handleWalletChange = (e)=>{
    const dpath= wallets[e].dpath;
    this.setState({dpath});
  };

  handlePasswordChange =(e)=>{
    this.setState({password:e.target.value})
  };

  handleMnemonicChange = (e)=>{
    this.setState({mnemonic:e.target.value,isMnemonicValid:isValidateMnemonic(e.target.value)})
  };

  showAddresses = () => {
    const {pageFrom} = this.props;
    const {mnemonic,dpath,password} = this.state;
    window.WALLET = new MnemonicUnlockAccount({mnemonic:mnemonic, dpath:dpath, password:password});
    window.WALLET_UNLOCK_TYPE = 'Mnemonic';
    this.props.modal.showModal({id: 'wallet/selectAccount', setWallet:this.setWallet, pageFrom:pageFrom})
  };

  bindShowAddress = (e) => {
    if(e.keyCode === 13){
      try{
        e.preventDefault();
        const {form} = this.props;
        const wallet = form.getFieldValue('wallet');
        const dpath= wallets[wallet].dpath;
        const mnemonic = form.getFieldValue('mnemonic');
        const password  = form.getFieldValue('password');
        const {pageFrom} = this.props;
        if(isValidateMnemonic(mnemonic) && dpath){
          window.WALLET = new MnemonicUnlockAccount({mnemonic:mnemonic, dpath:dpath, password:password});
          window.WALLET_UNLOCK_TYPE = 'Mnemonic';
          this.props.modal.showModal({id: 'wallet/selectAccount', setWallet:this.setWallet, pageFrom:pageFrom})
        }else{
          message.error(intl.get('wallet.mnemonic_tip'))
        }
      }catch (e){
        message.error(e.message)
      }

    }
  };

  setWallet = (index) => {
    const {account} = this.props;
    account.setMnemonic({...this.state,index});
    this.setState({
      dpath: null,
      mnemonic: null,
      isMnemonicValid: false,
      password:null,
    });
  };


  render() {
    const {form} = this.props;
    return (
      <div className="">
        <Alert
          message={<div className="color-red-600 fs18"><Icon type="exclamation-circle"/> {intl.get('wallet.not_recommended')}</div>}
          description={<div className="color-red-600"><div className="fs14">{intl.getHTML('wallet.instruction_mnemonic')}</div></div>}
          type="error"
          showIcon={false}
          className="mb15"
        />
        <Form layout="horizontal" className="">
          <Form.Item className="mb15" label={intl.get('wallet.select_wallet')}>
            {form.getFieldDecorator('wallet', {
              initialValue: '',
              rules: [{
                required:true,
                message:"Please select a kind of wallet"
              }]
            })(
              <Select
                showSearch
                optionFilterProp="children"
                size="large"
                onChange={this.handleWalletChange}
              >
                {wallets.map((item, index) =>
                  <Select.Option key={index} >{item.name}</Select.Option>
                )}
              </Select>
            )}
          </Form.Item>
          <Form.Item className="mb15" label={intl.get('wallet.paste_mnemonic')}>
            {form.getFieldDecorator('mnemonic', {
              initialValue:'',
              rules: [{
                required:true,
                message:intl.get('wallet.mnemonic_tip'),
                validator:(rule, value, cb) => isValidateMnemonic(value) ? cb() : cb(true)
              }]
            })(
              <Input.TextArea size="large" autosize={{minRows: 3, maxRows: 6}} onChange={this.handleMnemonicChange} onKeyDown={this.bindShowAddress}/>
            )}
          </Form.Item>
          <Form.Item className="mb25" label={intl.get('wallet.password')+"("+intl.get('wallet.optional')+")"}>
            {form.getFieldDecorator('password', {
              initialValue: '',
              rules: []
            })(
              <Input size="large" type="password" onChange={this.handlePasswordChange} onKeyDown={this.bindShowAddress}/>
            )}
          </Form.Item>
        </Form>
        <Button type="primary" className="d-block w-100" size="large"
                disabled={!this.state.dpath || !this.state.mnemonic || !this.state.isMnemonicValid} onClick={this.showAddresses}>{intl.get('wallet.unlock')}</Button>
      </div>
    )
  }

}


export default Form.create()(UnlockByMnemonic)

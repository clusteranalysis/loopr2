import React, { PropTypes } from 'react';
import UnlockWallet from './UnlockWallet'
import GenerateWallet from './GenerateWallet'
import BackupWallet from './BackupWallet'
import ExportKeystore from './ExportKeystore'
import ModalContainer from '../../../modules/modals/container'
import AccountContainer from '../../../modules/account/container'
import SelectAccount from './SelectAccount'
import Airdrop from './Airdrop'
import AirdropBind from './AirdropBind'

function Modals(props){
  return (
    <div>
			<ModalContainer id="wallet/unlock" width="60%" >
				<AccountContainer>
			  	<UnlockWallet />
			  </AccountContainer>
			</ModalContainer>
      <ModalContainer id="wallet/selectAccount" >
          <SelectAccount />
      </ModalContainer>
			<ModalContainer id="wallet/generate" >
				<AccountContainer>
					<GenerateWallet />
				</AccountContainer>
			</ModalContainer>
			<ModalContainer id="wallet/backup" >
        <AccountContainer>
          <BackupWallet />
        </AccountContainer>
      </ModalContainer>
      <ModalContainer id="wallet/export/keystore" >
			  <ExportKeystore />
			</ModalContainer>
      <ModalContainer id="wallet/airdrop" >
        <Airdrop />
      </ModalContainer>
      <ModalContainer id="wallet/bind" >
        <AirdropBind />
      </ModalContainer>
    </div>
  );
}

export default Modals;

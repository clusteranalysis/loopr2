import React from 'react';
import {Badge, Card} from 'antd';
import {generateBindAddressTx, getBindAddress} from "Loopring/ethereum/utils";
import {notifyTransactionSubmitted} from 'Loopring/relay/utils'
import {toHex} from "Loopring/common/formatter";
import CoinIcon from '../../common/CoinIcon';
import {projects} from "../../../common/config/data";
import mapAsync from 'async/map';
import intl from 'react-intl-universal';

class Airdrop extends React.Component {

  state = {
    projects
  };

  componentDidMount() {
    const _this = this;
    mapAsync(projects, async (project, callback) => {
      const address = await getBindAddress(window.WALLET.getAddress(), project.projectId);
      callback(null, {...project, address})
    }, (err, results) => {
      if (!err) {
        _this.setState({projects: results})
      }
    })
  }

  findBindAddress = (project) => {
    const targetProject = this.state.projects.find(pro => pro.projectId === project.projectId);
    return targetProject ? targetProject.address : '';
  };

  showDetailModal = (project) => {
    const {modals} = this.props;
    modals.showModal({id: 'wallet/bind', project: project, address: project.address})
  };

  render() {
    const {projects} = this.state;
    return (
      <Card title={intl.get('wallet.airdrop')}>
        {projects.map((project,index) => {
          return (<div className="row zb-b-b pt10 pb10 ml0 mr0 align-items-center" key={index}>
            <div className="col-auto pl0">
              <CoinIcon size="32" color="grey-900"/>
            </div>
            <div className="col pl0 pr0">
              <div className="fs2 color-black-1 font-weight-bold">
                {project.lrx.toUpperCase()} {this.findBindAddress(project) &&
              <Badge className="ml5" count={intl.get('wallet.binding')} style={{backgroundColor: '#52c41a'}}/>}
              </div>
              <div className="fs2 color-black-3 pl0 pr0">
                {intl.get('wallet.loopring_on',{project:intl.get(`wallet.${project.name.toLowerCase()}`)})}
              </div>
            </div>
            {!this.findBindAddress(project) && <div className="col-auto pr5">
              <div className="f2 color-black-3">
                <a className="color-primary-1" onClick={this.showDetailModal.bind(this, project)}>{intl.get('wallet.to_bind_address')}</a>
              </div>
            </div>
            }
            {this.findBindAddress(project) && <div className="col-auto pl0 pr5">
              <div className="f2 ">
                <a className="color-primary-1" onClick={this.showDetailModal.bind(this, project)}>{intl.get('wallet.to_edit')}</a>
              </div>
            </div>
            }
            <div className="col-auto pr0 pl0">
              <div className="f2 color-black-3">
                <i className="icon-loopring icon-loopring-right"/>
              </div>
            </div>
          </div>)
        })}
        <div className="mb25"></div>
      </Card>
    );
  }
}

export default Airdrop


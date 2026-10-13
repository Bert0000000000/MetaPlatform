import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import TopBar from './TopBar';
const mocks=vi.hoisted(()=>({server:vi.fn(),local:vi.fn(),alert:vi.fn()}));
vi.mock('@mate/shared',()=>({useAuth:()=>({user:{username:'writer'},logout:mocks.local}),Api:{logout:mocks.server},getRefreshToken:()=> 'fixture-refresh'}));
vi.mock('react-router-dom',()=>({useLocation:()=>({pathname:'/home'}),useNavigate:()=>vi.fn()}));
vi.mock('./ShellContext',()=>({useShell:()=>({setCommandOpen:vi.fn(),navMode:'side',toggleNavMode:vi.fn()})}));
vi.mock('./domains',()=>({DOMAINS:[],resolveDomain:()=>null,navigationBreadcrumb:()=>[],primaryDomains:()=>[]}));
vi.mock('@douyinfe/semi-ui',()=>{const Item=()=>null;return {Avatar:Item,Badge:Item,Breadcrumb:Item,Button:Item,Input:Item,Tabs:Item,Tag:Item,Dropdown:Object.assign(Item,{Menu:Item,Item,Divider:Item})};});
function findLogout(node:any):any {
 if(!React.isValidElement(node))return undefined;
 const props=node.props as any;
 if(props.onClick?.constructor.name==='AsyncFunction')return props.onClick;
 for(const child of [...React.Children.toArray(props.children),props.render]){const found=findLogout(child);if(found)return found;}
}
afterEach(()=>{vi.unstubAllGlobals();vi.resetAllMocks();});
describe('server and local logout',()=>{
 it('waits for provider result before clearing local storage',async()=>{
  vi.stubGlobal('window',{location:{href:''},alert:mocks.alert});
  let finish!:(value:any)=>void;mocks.server.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  const pending=findLogout(TopBar())();
  expect(mocks.server).toHaveBeenCalledWith('fixture-refresh');expect(mocks.local).not.toHaveBeenCalled();
  finish({blacklisted:true,providerLoggedOut:true});await pending;
  expect(mocks.local).toHaveBeenCalledOnce();expect(mocks.alert).not.toHaveBeenCalled();expect(window.location.href).toBe('/login');
 });
 it.each(['partial','unavailable'])('clears locally and explains %s server logout',async failure=>{
  vi.stubGlobal('window',{location:{href:''},alert:mocks.alert});
  if(failure==='partial')mocks.server.mockResolvedValue({blacklisted:true,providerLoggedOut:false});else mocks.server.mockRejectedValue(new Error('offline'));
  await findLogout(TopBar())();
  expect(mocks.local).toHaveBeenCalledOnce();expect(mocks.alert).toHaveBeenCalledWith(expect.stringContaining('服务端会话未确认退出'));expect(window.location.href).toBe('/login');
 });
});

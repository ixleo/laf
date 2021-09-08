/*
 * @Author: Maslow<wangfugen@126.com>
 * @Date: 2021-07-30 10:30:29
 * @LastEditTime: 2021-08-18 16:12:18
 * @Description: 
 */
import { Router } from 'express'
import { Proxy } from 'less-api'
import Config from '../../config'
import { createLogger } from '../../lib/logger'
import { DatabaseAgent } from '../../lib/database'
import { PolicyAgentInstance } from '../../lib/policy-agent'

const logger = createLogger('proxy')
const accessor = DatabaseAgent.accessor
export const EntryRouter = Router()

EntryRouter.post('/proxy/:policy', async (req, res) => {
  const requestId = req['requestId']
  const auth = req['auth'] ?? {}
  const policy_name = req.params?.policy

  // get corresponding policy
  const policy_comp = PolicyAgentInstance.get(policy_name)
  if (!policy_comp) {
    return res.status(404).send('Policy Not Found')
  }

  // create a database proxy
  const proxy = new Proxy(accessor, policy_comp.policy)

  // parse params
  const params = proxy.parseParams({ ...req.body, requestId })

  // get injections by invoking the injector function of policy
  const injections = await policy_comp.injector_func(auth, params)

  // validate query
  const result = await proxy.validate(params, injections)
  if (result.errors) {
    logger.error(requestId, `validate return errors: `, result.errors)
    return res.status(403).send({
      code: 'permission denied',
      error: result.errors,
      injections: Config.isProd ? undefined : injections
    })
  }

  // execute query
  try {
    const data = await proxy.execute(params)
    logger.debug(requestId, 'executed query success with params: ', params)
    logger.trace(requestId, `executed query: `, data)

    return res.send({
      code: 0,
      data
    })
  } catch (error) {
    logger.error(requestId, 'execute query got error:  ', error)
    return res.send({
      code: 1,
      error: error.toString(),
      injections: Config.isProd ? undefined : injections
    })
  }
})
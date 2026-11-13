import { describe, expect, it } from 'vitest'
import { evaluateGate } from './gates'
import { updateSequentialState } from './simulate'
import type { CircuitDefinition, Component } from './types'

describe('combinational gate truth tables', () => {
  it('evaluates NAND, AND, OR, NOR, XOR and XNOR', () => {
    expect(evaluateGate('NAND', [0, 0])).toBe(1)
    expect(evaluateGate('NAND', [1, 1])).toBe(0)
    expect(evaluateGate('AND', [1, 1])).toBe(1)
    expect(evaluateGate('OR', [0, 1])).toBe(1)
    expect(evaluateGate('NOR', [0, 0])).toBe(1)
    expect(evaluateGate('XOR', [1, 0])).toBe(1)
    expect(evaluateGate('XNOR', [1, 1])).toBe(1)
  })
  it('propagates unknown values rather than coercing them to zero', () => {
    expect(evaluateGate('NAND', [1, 'X'])).toBe('X')
    expect(evaluateGate('NOT', ['X'])).toBe('X')
  })
})

function pin(id:string, kind:Component['kind'], inputs:Component['inputs'], outputs:Component['outputs']):Component {
  return {id,kind,label:id,x:0,y:0,inputs,outputs}
}
const port=(id:string,name:string,direction:'input'|'output')=>({id,name,direction,bitWidth:1 as const})

describe('sequential state transitions', () => {
  it('captures D on a rising edge and holds between edges', () => {
    const input=pin('data','INPUT',[],[port('out','Y','output')])
    const clk=pin('clk','CLOCK',[],[port('out','Y','output')])
    const dff=pin('ff','DFF',[port('d','D','input'),port('clk','CLK','input')],[port('q','Q','output')])
    const c:CircuitDefinition={id:'c',name:'test',inputs:[],outputs:[],components:[input,clk,dff],wires:[
      {id:'w1',from:{componentId:'data',portId:'out'},to:{componentId:'ff',portId:'d'}},
      {id:'w2',from:{componentId:'clk',portId:'out'},to:{componentId:'ff',portId:'clk'}}
    ]}
    expect(updateSequentialState(c,{data:1},{ff:0},0,1).ff).toBe(1)
    expect(updateSequentialState(c,{data:0},{ff:1},1,0).ff).toBe(1)
  })
  it('captures data while an active-high latch is enabled', () => {
    const input=pin('data','INPUT',[],[port('out','Y','output')])
    const latch=pin('latch','LATCH',[port('d','D','input'),port('en','EN','input')],[port('q','Q','output')])
    const c:CircuitDefinition={id:'c',name:'test',inputs:[],outputs:[],components:[input,latch],wires:[
      {id:'w1',from:{componentId:'data',portId:'out'},to:{componentId:'latch',portId:'d'}}
    ]}
    expect(updateSequentialState(c,{data:1},{latch:0},0,1).latch).toBe(1)
  })
})

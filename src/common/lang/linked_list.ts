import { isNull } from '@/common/functions'

export interface ListNode<T> {
  prev: this | undefined
  next: this | undefined
  readonly value: T
}

class EndNode<T> implements ListNode<T> {
  prev: this | undefined
  next: this | undefined

  get value(): T {
    throw new Error('Cannot get value of end node')
  }
}

export class DataNode<T> {
  prev: ListNode<T> | undefined
  next: ListNode<T> | undefined

  constructor(public value: T) {}

  insertBetween(prev: ListNode<T> | undefined, next: ListNode<T> | undefined): void {
    this.prev = prev
    if (!isNull(prev)) {
      prev.next = this
    }

    this.next = next
    if (!isNull(next)) {
      next.prev = this
    }
  }

  remove(): void {
    if (!isNull(this.prev)) {
      this.prev.next = this.next
    }

    if (!isNull(this.next)) {
      this.next.prev = this.prev
    }

    this.prev = undefined
    this.next = undefined
  }
}

export class LinkedList<T> {
  readonly head: EndNode<T>
  readonly tail: EndNode<T>

  constructor() {
    this.head = new EndNode()
    this.tail = new EndNode()

    this.head.next = this.tail
    this.tail.prev = this.head
  }

  add(value: T): DataNode<T> {
    return this.addLast(value)
  }

  addFirst(value: T): DataNode<T> {
    const node = new DataNode(value)
    node.insertBetween(this.head, this.head.next)
    return node
  }

  addFirstNode(node: DataNode<T>): void {
    node.remove()
    node.insertBetween(this.head, this.head.next)
  }

  addLast(value: T): DataNode<T> {
    const node = new DataNode(value)
    node.insertBetween(this.tail.prev, this.tail)
    return node
  }

  get first(): DataNode<T> | undefined {
    const node = this.head.next
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return node === this.tail ? undefined : (node as DataNode<T>)
  }

  get last(): DataNode<T> | undefined {
    const node = this.tail.prev
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return node === this.head ? undefined : (node as DataNode<T>)
  }

  *[Symbol.iterator](): IterableIterator<T> {
    let node = this.head.next
    while (node && node !== this.tail) {
      yield node.value
      node = node.next
    }
  }
}

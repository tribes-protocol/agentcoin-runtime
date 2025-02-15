import { isNull } from '@/common/functions'
import { LinkedList } from '@/common/lang/linked_list'

export class Queue<T> {
  private readonly list: LinkedList<T> = new LinkedList<T>()
  private size_ = 0

  push(item: T): void {
    this.list.addLast(item)
    ++this.size_
  }

  pop(): T | undefined {
    const first = this.list.first
    if (isNull(first)) return undefined

    first.remove()
    --this.size_
    return first.value
  }

  peek(): T | undefined {
    const first = this.list.first
    if (isNull(first)) return undefined
    return first.value
  }

  items(): T[] {
    return [...this.list]
  }

  get size(): number {
    return this.size_
  }

  isEmpty(): boolean {
    return this.size_ === 0
  }

  isNotEmpty(): boolean {
    return this.size_ > 0
  }
}

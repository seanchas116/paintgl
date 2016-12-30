import {Vec2, Rect, Transform} from "paintvec"
import {Model} from "./Model"
import {Context} from "./Context"
import {Color} from "./Color"
import {Texture, PixelType, PixelFormat, glType, glFormat} from "./Texture"

export
abstract class DrawTarget {
  /**
    The size of this DrawTarget.
  */
  abstract size: Vec2

  abstract pixelType: PixelType

  abstract pixelFormat: PixelFormat

  /**
    The rectangle that masks draw region.
  */
  scissor: Rect|undefined

  /**
    Whether y coordinate is flipped.
  */
  flipY = false

  /**
    The global transform that applies to all drawables.
  */
  transform = new Transform()

  /**
    @params context The context this `DrawTarget` belongs to.
  */
  constructor(public context: Context) {
  }

  /**
    Draws the `model` into this `DrawTarget`.
  */
  draw(model: Model) {
    this.use()

    const {size} = this
    let transform = this.transform
      .merge(Transform.scale(new Vec2(2 / size.width, 2 / size.height)))
      .merge(Transform.translate(new Vec2(-1)))
    if (this.flipY) {
      transform = transform.merge(Transform.scale(new Vec2(1, -1)))
    }

    model.draw(transform)
  }

  /**
    Clear this `DrawTarget` with `color`.
  */
  clear(color: Color) {
    this.use()
    const {gl} = this.context
    gl.clearColor(color.r, color.g, color.b, color.a)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  readPixels(rect: Rect, data: ArrayBufferView, opts: {format?: PixelFormat, type?: PixelType} = {}) {
    this.use()
    const {gl} = this.context
    rect = this._flipRect(rect)
    gl.readPixels(rect.left, rect.top, rect.width, rect.height, glFormat(gl, opts.format || this.pixelFormat), glType(this.context, opts.type || this.pixelType), data)
  }

  protected use() {
    const {gl} = this.context
    if (this.scissor) {
      gl.enable(gl.SCISSOR_TEST)
      const drawableRect = new Rect(new Vec2(0), this.size)
      const rect = this._flipRect(this.scissor).intBounding().intersection(drawableRect)
      if (rect) {
        gl.scissor(rect.left, rect.top, rect.width, rect.height)
      } else {
        gl.scissor(0, 0, 0, 0)
      }
    } else {
      gl.disable(gl.SCISSOR_TEST)
    }
    gl.viewport(0, 0, this.size.x, this.size.y)
  }

  private _flipRect(rect: Rect) {
    if (this.flipY) {
      const {left, right} = rect
      const top = this.size.height - rect.bottom
      const bottom = this.size.height - rect.top
      return new Rect(new Vec2(left, top), new Vec2(right, bottom))
    }
    return rect
  }

  dispose() {
  }
}

/**
  CanvasDrawTarget represents the draw target that draws directly into the context canvas.
*/
export
class CanvasDrawTarget extends DrawTarget {
  flipY = true

  get size() {
    const {canvas} = this.context
    return new Vec2(canvas.width, canvas.height)
  }

  pixelType: PixelType = "byte"
  pixelFormat: PixelFormat = "rgba"

  protected use() {
    const {gl} = this.context
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    super.use()
  }
}

/**
  TextureDrawTarget represents the draw target that draws into a texture.
*/
export
class TextureDrawTarget extends DrawTarget {
  framebuffer: WebGLFramebuffer
  private _texture: Texture|undefined

  get texture() {
    return this._texture
  }
  set texture(texture: Texture|undefined) {
    if (texture) {
      const {gl} = this.context
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture.texture, 0)
    }
    this._texture = texture
  }

  constructor(public context: Context, texture?: Texture) {
    super(context)
    const {gl} = context
    this.framebuffer = gl.createFramebuffer()!
    this.texture = texture
  }

  get size() {
    if (this.texture) {
      return this.texture.size
    } else {
      return new Vec2()
    }
  }

  get pixelType(): PixelType {
    if (this.texture) {
      return this.texture.pixelType
    } else {
      return "byte"
    }
  }

  get pixelFormat(): PixelFormat {
    if (this.texture) {
      return this.texture.pixelFormat
    } else {
      return "rgba"
    }
  }

  protected use() {
    const {gl} = this.context
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    super.use()
  }

  dispose() {
    const {gl} = this.context
    gl.deleteFramebuffer(this.framebuffer)
  }
}

/* webp_jsplayer.js – SuperWebP: SuperGif-compatible API for animated WebP  */
(function (root, factory) {
	if (typeof module === 'object' && module.exports) {
		module.exports = factory();
	} else {
		root.SuperWebP = factory();
	}
}(typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	function noop () {}

	function SuperWebP (opts) {
		opts = opts || {};
		this.webp            = opts.webp;					// <img> element
		this.auto_play       = opts.auto_play !== false;	// default → true
		this.loop_delay      = opts.loop_delay || 0;
		this.on_end          = opts.on_end || noop;

		this.supported       = ('ImageDecoder' in window) && ImageDecoder.isTypeSupported?.('image/webp');
		this.frames          = [];
		this.delays          = [];
		this.current_frame   = 0;
		this.playing         = false;
		this._tId            = null;

		this.canvas          = null;
		this.ctx             = null;
	}

	/* PUBLIC ------------------------------------------- */
	SuperWebP.prototype.load = function (cb) {
		cb = cb || noop;
		const img = this.webp;
		const src = img.getAttribute('rel:animated_src') || img.src;

		if (!this.supported) {
			/* graceful fallback: keep plain <img> */
			img.src = src;
			cb(this);
			if (this.auto_play) this.play();	// native browser playback
			return;
		}

		fetch(src)
			.then(r => r.arrayBuffer())
			.then(buf => this._decode(buf))
			.then(() => {
				this._swap_to_canvas();
				cb(this);
				if (this.auto_play) this.play();
			})
			.catch(err => { console.error('SuperWebP load error', err); });
	};

	SuperWebP.prototype.play = function () {
		if (!this.supported || this.playing || !this.frames.length) return;
		this.playing = true;

		const step = () => {
			if (!this.playing) return;
			const delay = this.delays[this.current_frame] || 100;	// ← use current
			this.draw(this.current_frame);
			this.current_frame = (this.current_frame + 1) % this.frames.length;

			const next = (this.current_frame === 0 && this.loop_delay)
				? this.loop_delay
				: delay;
			this._tId = setTimeout(step, next);
		};
		step();
	};

	SuperWebP.prototype.pause = function () {
		this.playing = false;
		clearTimeout(this._tId);
	};

	SuperWebP.prototype.toggle_play = function () {
		this.playing ? this.pause() : this.play();
	};

	SuperWebP.prototype.move_to = function (idx) {
		if (!this.supported || idx < 0 || idx >= this.frames.length) return;
		this.current_frame = idx;
		this.draw(idx);
	};

	// relative step (needed for prev/next buttons)
	SuperWebP.prototype.move_relative = function(delta) {
		if (!this.supported || !this.frames.length) return;
		var len = this.frames.length;
		var idx = (this.current_frame + delta) % len;
		if (idx < 0) idx += len;
		this.move_to(idx);
	};

	SuperWebP.prototype.get_frames_length  = function () { return this.frames.length; };
	SuperWebP.prototype.get_current_frame  = function () { return this.current_frame;  };
	SuperWebP.prototype.is_playing         = function () { return this.playing; };

	SuperWebP.prototype.draw = function (idx) {
		if (!this.supported) return;
		this.ctx.drawImage(this.frames[idx], 0, 0);
	};

	/* PRIVATE ----------------------------------------- */
	SuperWebP.prototype._decode = async function (buf) {
		const dec = new ImageDecoder({ data: buf, type: 'image/webp' });
		await dec.tracks.ready;
		const count = dec.tracks.selectedTrack.frameCount;
		for (let i = 0; i < dec.tracks.selectedTrack.frameCount; i++) {
			const { image: vframe } = await dec.decode({ frameIndex: i });	// ← result object
			const bmp   = await createImageBitmap(vframe);
			const delay = Math.max((vframe.duration || 0) / 1000, 20);		// µs → ms, clamp ≥20 ms
			vframe.close();													// free VideoFrame

			this.frames.push(bmp);
			this.delays.push(delay);
		}
	};

	SuperWebP.prototype._swap_to_canvas = function () {
		const first = this.frames[0];
		this.canvas = document.createElement('canvas');
		this.canvas.width  = first.displayWidth  || first.width;
		this.canvas.height = first.displayHeight || first.height;
		this.ctx    = this.canvas.getContext('2d');
		this.webp.parentNode.replaceChild(this.canvas, this.webp);
		this.draw(0);
	};

	return SuperWebP;
}));

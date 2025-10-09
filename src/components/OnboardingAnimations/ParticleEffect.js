import React, { useEffect, useRef } from 'react';

// 粒子系統類
class ParticleSystem {
  constructor(canvas, type = 'sparkles', intensity = 1) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.type = type;
    this.intensity = intensity;
    this.particles = [];
    this.animationId = null;
    
    this.resizeCanvas();
    this.createParticles();
    this.bindEvents();
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
  }

  createParticles() {
    const particleCount = Math.floor(120 * this.intensity); // 進一步增加粒子數量
    
    for (let i = 0; i < particleCount; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle() {
    const canvasWidth = this.canvas.width / window.devicePixelRatio;
    const canvasHeight = this.canvas.height / window.devicePixelRatio;
    
    switch (this.type) {
      case 'sparkles':
        return new SparkleParticle(canvasWidth, canvasHeight, 5000); // 5秒
      case 'confetti':
        return new ConfettiParticle(canvasWidth, canvasHeight, 5000); // 5秒
      case 'stars':
        return new StarParticle(canvasWidth, canvasHeight, 5000); // 5秒
      default:
        return new SparkleParticle(canvasWidth, canvasHeight, 5000); // 5秒
    }
  }

  update() {
    this.particles.forEach((particle, index) => {
      particle.update();
      
      if (particle.isDead()) {
        this.particles[index] = this.createParticle();
      }
    });
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.particles.forEach(particle => {
      particle.render(this.ctx);
    });
  }

  animate() {
    this.update();
    this.render();
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this.resizeCanvas);
  }
}

// 閃爍粒子類
class SparkleParticle {
  constructor(canvasWidth, canvasHeight, duration = 5000) {
    this.x = Math.random() * canvasWidth;
    this.y = Math.random() * canvasHeight;
    this.vx = (Math.random() - 0.5) * 1.5; // 減慢移動速度
    this.vy = (Math.random() - 0.5) * 1.5;
    this.life = 1;
    this.duration = duration; // 持續時間（毫秒）
    this.decay = 1 / (duration / 16); // 根據持續時間計算衰減速度
    this.size = Math.random() * 4 + 2; // 增大粒子尺寸
    this.color = this.getRandomColor();
    this.alpha = Math.random() * 0.9 + 0.3; // 提高初始透明度
    this.maxLife = this.life; // 記錄最大生命值
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  getRandomColor() {
    const colors = [
      '#7234CF', '#52c41a', '#1890ff', '#faad14', '#ff4d4f',
      '#13c2c2', '#722ed1', '#eb2f96', '#fa8c16', '#a0d911'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    
    // 使用更平滑的透明度變化
    this.alpha = this.life * (0.7 + 0.3 * Math.sin(Date.now() * 0.003));
    
    // 減慢重力效果
    this.vy += 0.005;
    
    // 添加邊界反彈
    if (this.x < 0 || this.x > this.canvasWidth) this.vx *= -0.8;
    if (this.y < 0 || this.y > this.canvasHeight) this.vy *= -0.8;
  }

  render(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 15; // 增大陰影模糊
    ctx.shadowColor = this.color;
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    
    // 添加內層高光
    ctx.shadowBlur = 0;
    ctx.globalAlpha = Math.max(0, this.alpha * 0.5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x - this.size * 0.3, this.y - this.size * 0.3, this.size * 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  isDead() {
    return this.life <= 0;
  }
}

// 彩紙粒子類
class ConfettiParticle {
  constructor(canvasWidth, canvasHeight, duration = 5000) {
    this.x = Math.random() * canvasWidth;
    this.y = -10;
    this.vx = (Math.random() - 0.5) * 3; // 減慢水平速度
    this.vy = Math.random() * 2 + 1.5; // 減慢垂直速度
    this.life = 1;
    this.duration = duration; // 持續時間（毫秒）
    this.decay = 1 / (duration / 16); // 根據持續時間計算衰減速度
    this.size = Math.random() * 10 + 6; // 增大粒子尺寸
    this.color = this.getRandomColor();
    this.rotation = 0;
    this.rotationSpeed = (Math.random() - 0.5) * 0.15; // 減慢旋轉速度
    this.shape = Math.random() > 0.5 ? 'rect' : 'circle';
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  getRandomColor() {
    const colors = ['#7234CF', '#52c41a', '#1890ff', '#faad14', '#ff4d4f'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotationSpeed;
    this.life -= this.decay;
    
    // 減慢旋轉和搖擺
    this.vx += (Math.random() - 0.5) * 0.05;
    this.vy += 0.03; // 減慢重力
    
    // 邊界處理
    if (this.x < 0) this.x = this.canvasWidth;
    if (this.x > this.canvasWidth) this.x = 0;
  }

  render(ctx) {
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    // 添加陰影效果
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    
    if (this.shape === 'rect') {
      ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.size/2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }

  isDead() {
    return this.life <= 0 || this.y > this.canvasHeight + 50;
  }
}

// 星星粒子類
class StarParticle {
  constructor(canvasWidth, canvasHeight, duration = 5000) {
    this.x = Math.random() * canvasWidth;
    this.y = Math.random() * canvasHeight;
    this.vx = (Math.random() - 0.5) * 0.8; // 減慢移動速度
    this.vy = (Math.random() - 0.5) * 0.8;
    this.life = 1;
    this.duration = duration; // 持續時間（毫秒）
    this.decay = 1 / (duration / 16); // 根據持續時間計算衰減速度
    this.size = Math.random() * 6 + 3; // 增大粒子尺寸
    this.color = '#faad14';
    this.twinkle = Math.random() * Math.PI * 2;
    this.twinkleSpeed = Math.random() * 0.08 + 0.03; // 減慢閃爍速度
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.twinkle += this.twinkleSpeed;
    this.life -= this.decay;
    
    // 邊界反彈
    if (this.x < 0 || this.x > this.canvasWidth) this.vx *= -0.9;
    if (this.y < 0 || this.y > this.canvasHeight) this.vy *= -0.9;
  }

  render(ctx) {
    ctx.save();
    const twinkleAlpha = 0.6 + 0.4 * Math.sin(this.twinkle);
    ctx.globalAlpha = this.life * twinkleAlpha;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 20; // 增大陰影模糊
    ctx.shadowColor = this.color;
    
    // 繪製五角星
    this.drawStar(ctx, this.x, this.y, this.size, 5);
    
    // 添加內層高光
    ctx.shadowBlur = 0;
    ctx.globalAlpha = this.life * twinkleAlpha * 0.3;
    ctx.fillStyle = '#ffffff';
    this.drawStar(ctx, this.x - this.size * 0.2, this.y - this.size * 0.2, this.size * 0.4, 5);
    
    ctx.restore();
  }

  drawStar(ctx, x, y, radius, points) {
    const angle = Math.PI / points;
    ctx.beginPath();
    
    for (let i = 0; i < 2 * points; i++) {
      const r = i % 2 === 0 ? radius : radius * 0.5;
      const a = i * angle;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    
    ctx.closePath();
    ctx.fill();
  }

  isDead() {
    return this.life <= 0;
  }
}

const ParticleEffect = ({ type = 'sparkles', intensity = 1 }) => {
  const canvasRef = useRef(null);
  const particleSystemRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 創建粒子系統
    particleSystemRef.current = new ParticleSystem(canvas, type, intensity);
    particleSystemRef.current.animate();

    return () => {
      if (particleSystemRef.current) {
        particleSystemRef.current.destroy();
      }
    };
  }, [type, intensity]);

  return (
    <canvas
      ref={canvasRef}
      className="particle-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
        opacity: 1.0 // 提高整體透明度
      }}
    />
  );
};

export default ParticleEffect;

---
title: "Mired 与 Kelvin：深入理解色温控制"
description: "对比 Mired 与 Kelvin 单位的差异、历史和应用场景，补上调光调色的背景知识。"
pubDate: "May 7, 2025"
socialImage: "https://image.niracler.com/2025/03/2e3bf667bb2c02aa253c16a0aae5b762.png"
tags: [ "TIL", "照明", "色温", "调光", "DeepSearch" ]
---
> **提示：** 本文主要由 DeepSearch 生成，作者仅做校对与补充。


## 要点总结

Mired 和 Kelvin 是色温控制中常用的两种单位。Kelvin (K) 直接测量光源的色温，是色温的标准单位。然而，人类对色温变化的感知并非线性，例如 3000K 到 4000K 的变化比 5000K 到 6000K 的变化在视觉上更为显著。Mired（微互成度）是 Kelvin 的倒数乘以一百万（$M = \frac{1,000,000}{T}$），它提供了一个更符合人类感知的线性尺度。色温概念起源于17世纪牛顿的光学实验，Kelvin 温标在19世纪由开尔文勋爵提出。1932年，Irwin G. Priest 提出了 Mired 的概念，以解决 Kelvin 尺度在感知上的非线性问题。色温广泛应用于摄影（白平衡）、照明设计（营造氛围）和显示技术（颜色校准）等领域。

## Mired 和 Kelvin 的定义与区别

### Kelvin (K)

Kelvin 是国际单位制中温度的基本单位，也用于衡量光源的颜色温度。色温描述的是一个理想黑体辐射器加热到特定温度时所发出的光的颜色。例如：

* 蜡烛火焰：约 1850K
* 钨丝灯泡（家用）：约 2700-3300K
* 日光（平均）：约 5600K
* 阴天：约 6500-7500K

Kelvin 值直接反映了光源的物理特性。然而，正如前面提到的，Kelvin 尺度在描述人类对色温变化的感知时存在非线性问题。

### Mired (Micro Reciprocal Degree)

Mired，即微倒数度或微互成度，是为了弥补 Kelvin 在感知线性度上的不足而引入的单位。其计算公式为：

$$ M = \frac{1,000,000}{T_K} $$

其中 $T_K$ 是以 Kelvin 为单位的色温。

通过 Mired，色温变化的感知变得更加线性。例如：

* 从 3000K (333 Mired) 到 4000K (250 Mired) 的变化是 83 Mired。
* 从 5000K (200 Mired) 到 6000K (167 Mired) 的变化是 33 Mired。

这更准确地反映了人眼对前者色温变化更为敏感的事实。

### 主要区别

| 特性 | Kelvin (K) | Mired |
| -------------- | ---------------------------------------- | -------------------------------------------- |
| **定义** | 色温的绝对单位，基于黑体辐射 | 色温的倒数，更符合人类感知 |
| **感知线性度** | 非线性 | 相对线性 |
| **主要用途** | 定义光源的固有色温 | 计算色温校正值（如滤镜），调整色温 |
| **示例** | 日光灯约为 5600K | 从 3200K 调至 5500K 需约 -137 Mired 滤镜 |

在实际应用中，Kelvin 通常用于标识光源本身固有的色温类型，而 Mired 则更多地应用于需要调整或校正色温的场景，尤其是在摄影和专业照明领域，它可以帮助精确计算所需的滤镜强度。

## Mired 和 Kelvin 的前世今生

色温概念的发展历程漫长而有趣：

* **17世纪**：艾萨克·牛顿爵士 (Sir Isaac Newton) 在1665年通过三棱镜实验，将白光分解为七色光谱（红、橙、黄、绿、蓝、靛、紫），奠定了现代光学和颜色理论的基础。
* **19世纪**：随着温度测量技术的发展，科学家们开始探索热与光之间的关系。威廉·汤姆森，即后来的开尔文勋爵 (Lord Kelvin)，在19世纪中期提出了绝对温标，即 Kelvin 温标，以绝对零度 (-273.15°C) 为起点。这为色温的量化提供了标准单位。
* **20世纪初**：色温测量和标准化取得重要进展。1931年，国际照明委员会 (CIE) 定义了 CIE XYZ 色彩空间，并引入了相关色温 (Correlated Color Temperature, CCT) 的概念，用于描述非理想黑体光源的颜色特性。
* **1932年**：美国国家标准局的科学家欧文·G·普里斯特 (Irwin G. Priest) 发表了关键论文，指出人类对色温差异的感知与色温的倒数值成正比，而非色温的绝对差值。他因此提出了 "Mired" (micro-reciprocal-degree) 这一单位。这一发现极大地推动了色温在实际应用中的精确控制，特别是在摄影滤镜和照明设计领域。Mired 的引入有效解决了 Kelvin 尺度在感知上的非线性问题。

苹果的 HomeKit 平台也采用 Mired 来指定灯光的色温，进一步证明了其在现代智能家居技术中的实用性。

## 关于色温的那些事

色温不仅仅是一个物理参数，它深刻影响着我们的视觉体验和心理感受。

* **暖色调与冷色调**：
  * 低色温（通常低于 3300K）的光源呈现偏红、橙、黄的暖色调，能营造出温馨、舒适、放松的氛围，例如白炽灯和日出日落时的阳光。
  * 高色温（通常高于 5300K）的光源呈现偏蓝的冷色调，能带来清爽、专注、警觉的感觉，例如正午日光和阴天的光线。
  * 中等色温（3300K - 5300K）的光线则相对中性，常被称为"白光"。

* **摄影与白平衡 (White Balance, WB)**：
    人类的视觉系统具有很强的适应性，可以在不同色温的光线下识别出物体本来的颜色。但相机等成像设备则不然，它们需要通过"白平衡"设置来校正不同光源下的颜色偏差，以确保白色物体在照片中呈现为准确的白色。摄影师常根据拍摄环境的色温（如钨丝灯 3200K，闪光灯 5500K）调整相机的白平衡，或使用不同 Mired 值的滤色片来达到期望的色温效果。

* **照明设计**：
    在室内外照明设计中，色温的选择至关重要。
  * **家居照明**：卧室、客厅等区域通常采用暖色温（2700K-3000K）光源，以营造舒适放松的氛围。书房、厨房等区域可能选用中性或稍冷的色温（3500K-4500K）以提高专注度和清晰度。
  * **商业与办公照明**：办公室、商场、医院等场所常采用中性到冷白色温（4000K-6500K），有助于提高工作效率和警觉性。
  * **显色指数 (Color Rendering Index, CRI)**：除了色温，光源的显色指数也非常重要。CRI衡量光源还原物体真实颜色的能力，高CRI（通常大于80或90）的光源能更准确地展现物品的色彩。

* **显示技术与色彩校准**：
    显示器、电视和投影仪等设备的色彩表现也与色温密切相关。D65 (对应约 6504K) 是一个常见的行业标准白点，用于确保在不同设备上观看内容时颜色的一致性。

### 常见光源色温及对应 Mired 值

| 光源类型 | 色温 (K) | Mired 值 |
| -------------------- | ---------------- | ---------- |
| 烛光 | 1850 | 541 |
| 白炽灯 (100W) | 2800-2900 | 357-345 |
| 卤素灯 | 3000 | 333 |
| 钨丝灯 (摄影棚) | 3200 | 312 |
| 日出/日落 | 2000-3000 | 500-333 |
| LED (暖白) | 2700-3000 | 370-333 |
| LED (中性白) | 3500-4500 | 286-222 |
| LED (冷白/日光型) | 5000-6500 | 200-154 |
| 正午太阳光 | 5000-5800 | 200-172 |
| 电子闪光灯 | 5500-6000 | 182-167 |
| 阴天/多云 | 6500-7500 | 154-133 |
| 显示器标准 (D65) | 6504 | 154 |

*数据来源: 综合 Wikipedia 及行业常见数值。*

## 总结与展望

Kelvin 和 Mired 都是描述色温的重要单位，但它们各有侧重。Kelvin 直接定义了光源的物理色温，而 Mired 则提供了一个更符合人类视觉感知的尺度，尤其在需要精确调整色温的摄影和照明领域中至关重要。从牛顿的光学启蒙到现代复杂的照明系统，对色温的理解和应用不断深化。随着 LED 技术和智能控制系统的发展，未来我们可以期待更加个性化、更利于健康的动态色温照明方案，Mired 和 Kelvin 的概念将继续在其中扮演核心角色。

---

## 参考资料与拓展阅读

* [Mired - Wikipedia](https://en.wikipedia.org/wiki/Mired)
* [Color temperature - Wikipedia](https://en.wikipedia.org/wiki/Color_temperature)
* [Colour temperature: mireds versus Kelvin – Visuals Producer](https://visualsproducer.wordpress.com/2020/11/29/mireds-versus-degrees-kelvin-for-colour-temperature/)
* Priest, I. G. (1932). *A proposed scale for use in specifying the chromaticity of incandescent illuminants and various phases of daylight*. Journal of the Optical Society of America, 23(2), 41-45. (DOI: `10.1364/JOSA.23.000041`)
* [Apple Developer Documentation - HMCharacteristicTypeColorTemperature](https://developer.apple.com/documentation/homekit/hmcharacteristictypecolortemperature)
* [Understanding color temperature - Westinghouse Lighting](https://www.westinghouselighting.com/color-temperature.aspx)
* [Color Temperature - Evident Scientific](https://evidentscientific.com/en/microscope-resource/knowledge-hub/lightandcolor/colortemp)
* [Mired/Filter Calculator - Points in Focus Photography](https://www.pointsinfocus.com/tools/mired-calculator/)
* [WHAT COLOUR IS THAT TEMPERATURE? - Video & Filmmaker magazine](https://videoandfilmmaker.com/wp/tutorials/colour-temperature/)


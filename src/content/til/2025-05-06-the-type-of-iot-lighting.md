---
title: "物联网照明的类型分析"
description: "梳理 IoT 灯具的 DIM、CCT、RGB 等类型及协议差异，顺便补课相关标准组织。"
pubDate: "May 6, 2025"
socialImage: "https://image.niracler.com/2025/03/2e3bf667bb2c02aa253c16a0aae5b762.png"
tags: [ "TIL", "物联网", "照明", "协议", "DeepSearch" ]
---
> **提示：** 本文主要由 DeepSearch 生成，作者仅做校对与补充。


## 要点总结

物联网中的灯主要包括可调光（DIM）、可调色温（CCT）、可变色（RGB）等类型，这些分类基于灯具功能。这些分类不是协议，而是描述灯具能力的术语，它们是通用的照明功能描述。照明工程协会（IES）可能通过标准如ANSI/IES LP-12-21提供了相关指导，但这些分类并非由单一机构提出。

## 灯的种类与分类

物联网中的灯根据其控制功能分为几类，例如：

- **可调光（DIM）**：可以调节亮度的灯。
- **可调色温（CCT）**：可以改变白光温暖程度的灯，从暖白到冷白。
- **可变色（RGB）**：通过混合红、绿、蓝三种颜色产生多种颜色的灯。
- 还有组合类型如RGBW（RGB+白光）和RGB+CCT（RGB+可调色温）。

这些分类帮助用户根据需求选择合适的灯具，例如在卧室可能更喜欢暖白光（CCT），而在娱乐场所可能需要彩色灯光（RGB）。

## 分类是否为协议

DIM、CCT、RGB等分类不是协议，而是灯具功能的描述。在物联网中，这些灯通过如Zigbee、Wi-Fi、Bluetooth或Matter等标准协议进行控制，但这些术语本身不属于协议。

## 提出机构

这些分类是照明行业的通用术语，照明工程协会（IES）通过标准如[ANSI/IES LP-12-21 IoT Connected Lighting](https://store.ies.org/product/lighting-practice-iot-connected-lighting/)提供了相关指导，但并非由单一机构独家提出。

## 详细分析

### 物联网中灯的种类功能详解

根据功能，物联网中的灯可以分为以下几类：

- **可调光（DIM）**：指可以调节亮度的灯，用户可以通过IoT设备调整光线强弱，适合需要不同照明环境的空间。
- **可调色温（CCT）**：即Correlated Color Temperature，可调白光灯，可以从暖白（约2700K）调整到冷白（6500K以上），用于创建不同的氛围，例如卧室可能偏向暖白，办公室可能偏向冷白。
- **可变色（RGB）**：通过红、绿、蓝三种LED组合，可以产生1600万种颜色，适合娱乐场所或装饰照明。
- **RGBW**：在RGB基础上增加白光LED，提供更真实的白光，适合需要高质量白光的场景。
- **RGB+CCT**：结合RGB的颜色变化和CCT的可调白光功能，适合多功能需求的空间。

### 分类原因分析

这些分类的目的是描述灯具的不同控制能力，满足多样化的照明需求：

- DIM功能适合节能和氛围调节，如餐厅可能需要低亮度营造温馨环境。
- CCT功能影响光线的温暖程度，研究表明不同色温对人体生理和心理有不同影响，例如暖光有助于放松，冷光提升专注力。
- RGB功能则用于装饰和动态照明，如节日灯光或舞台效果。

从技术角度，这些分类反映了LED技术的进步和IoT控制的灵活性。用户可以通过智能手机或智能家居系统远程调整这些功能，增强了便利性和个性化。

### RGB、RGBW和RGB-CCT的比较

以下表格比较了RGB、RGBW和RGB-CCT的差异，基于[Lucas LED的分析](https://lucasled.ie/blog/post/what-is-the-difference-between-rgb-rgbw-and-rgb-cct-led-strip-lights)：

| 类型     | 描述                                         | 颜色能力                                       | 白光细节                                     | 核心线数 | LED芯片数 |
|----------|----------------------------------------------|------------------------------------------------|----------------------------------------------|----------|-----------|
| RGB      | 使用红、绿、蓝LED，提供1600万种颜色          | 1600万种颜色，可调饱和度和亮度                 | 无真实白光，白色由RGB组合生成，非纯白        | 4        | 3         |
| RGBW     | 在RGB基础上增加白光LED，提供真实白光         | 1600万种颜色+真实白光，可选暖白、自然白、冷白  | 真实白光，选项取决于型号/用途                | 5        | 4         |
| RGB-CCT  | 结合全色谱+可调白光，从暖白到冷白            | 1600万种颜色+白光全谱                         | 两个白光芯片覆盖2700K到6500K+                | 6        | 5         |

### 未来趋势

当前，IoT照明市场快速增长，DIM、CCT、RGB功能的集成度越来越高。研究表明，未来可能出现更多组合功能，如"Dim-to-Warm"（调光变暖），进一步模糊分类界限。

## 参考资料

- [ANSI/IES LP-12-21 IoT Connected Lighting](https://store.ies.org/product/lighting-practice-iot-connected-lighting/)
- [Sunricher Zigbee LED控制器](https://www.sunricher.com/dim-cct-rgbw-rgb-cct-4-in-1-constant-voltage-zigbee-led-controller-sr-zg1029-5c.html)
- [Lucas LED RGB RGBW RGB-CCT差异](https://lucasled.ie/blog/post/what-is-the-difference-between-rgb-rgbw-and-rgb-cct-led-strip-lights)
- [CSA-IOT RGB CCT Dimmable LED Downlight](https://csa-iot.org/csa_product/rgb-cct-dimmable-led-downlight/)
- [IES照明定义标准](https://www.ies.org/standards/definitions/)

